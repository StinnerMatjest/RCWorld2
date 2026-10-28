import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { getParkName, logChange } from "@/app/lib/changelog";

// The photo deck / strip at the top of the park page shows the photos flagged
// here (none flagged = every photo), each framed by its focus ("cx cy zoom",
// the crop editor's string) in the 4:5 card. Added in place; runs once per process.
let featuredColumn: Promise<void> | null = null;
function ensureFeaturedColumn(): Promise<void> {
    if (!featuredColumn) {
        featuredColumn = pool
            .query(`ALTER TABLE visitgallery ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false`)
            .then(() => pool.query(`ALTER TABLE visitgallery ADD COLUMN IF NOT EXISTS focus TEXT`))
            .then(() => undefined)
            .catch((err) => { featuredColumn = null; throw err; });
    }
    return featuredColumn;
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const visitId = parseInt(id, 10);

        if (isNaN(visitId)) return NextResponse.json({ gallery: [] });

        await ensureFeaturedColumn();
        // Gallery order is the saved sort_order (the drag-and-drop layout), then upload order.
        const res = await pool.query(
            `SELECT id, title, path, description, featured, focus
       FROM visitgallery
       WHERE visit_id = $1
       ORDER BY sort_order ASC NULLS LAST, id ASC`,
            [visitId]
        );

        return NextResponse.json({ gallery: res.rows });
    } catch (error) {
        console.error("Failed to fetch visit gallery:", error);
        return NextResponse.json({ error: "Failed to fetch gallery images" }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    revalidateContent();
    try {
        const { id } = await context.params;
        const visitId = parseInt(id, 10);
        const { title, path, description } = await req.json();

        if (typeof title !== "string" || typeof path !== "string" || typeof description !== "string") {
            return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 });
        }

        // Look up the park_id associated with this visit for the changelog
        const visitRes = await pool.query("SELECT park_id FROM visits WHERE id = $1", [visitId]);
        const parkId = visitRes.rows[0]?.park_id;

        const query = `
      INSERT INTO visitgallery (title, path, description, visit_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
        const inserted = await pool.query(query, [title, path, description, visitId]);

        if (parkId) {
            logChange({
                parkId,
                entityType: "image",
                entityId: inserted.rows[0]?.id,
                label: await getParkName(parkId),
                action: "create",
                summary: `Added gallery image "${title}"`,
                details: { title, path, description },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save gallery image", error);
        return NextResponse.json({ error: "Failed to save gallery image" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    revalidateContent();
    const client = await pool.connect();
    try {
        const { id } = await context.params;
        const visitId = parseInt(id, 10);
        const { reorderedIds } = await req.json();

        if (!reorderedIds || !Array.isArray(reorderedIds)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // One statement for the whole order (a visit can have 60 photos; one
        // round trip each used to take ten seconds on the hosted database).
        const ids = reorderedIds.map(Number).filter((n) => Number.isFinite(n));
        await client.query(
            `UPDATE visitgallery AS g SET sort_order = o.ord
             FROM unnest($2::int[]) WITH ORDINALITY AS o(id, ord)
             WHERE g.id = o.id AND g.visit_id = $1`,
            [visitId, ids]
        );
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Failed to reorder visit gallery:", error);
        return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
    } finally {
        client.release();
    }
}

/**
 * Which photos open the page (the deck on phones, the strip on desktop), and
 * how each is framed: { featuredIds?: number[], focus?: { [imageId]: "cx cy zoom" | null } }.
 */
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    revalidateContent();
    try {
        const { id } = await context.params;
        const visitId = parseInt(id, 10);
        const { featuredIds, focus } = await req.json();
        const hasIds = Array.isArray(featuredIds);
        const hasFocus = !!focus && typeof focus === "object" && !Array.isArray(focus);
        if (isNaN(visitId) || (!hasIds && !hasFocus)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }
        await ensureFeaturedColumn();
        if (hasIds) {
            const ids = (featuredIds as unknown[]).map(Number).filter((n) => Number.isFinite(n));
            await pool.query(
                `UPDATE visitgallery SET featured = (id = ANY($2::int[])) WHERE visit_id = $1`,
                [visitId, ids]
            );
        }
        if (hasFocus) {
            const entries = Object.entries(focus as Record<string, unknown>)
                .map(([k, v]) => [Number(k), v == null ? null : String(v).slice(0, 64)] as const)
                .filter(([k]) => Number.isFinite(k));
            if (entries.length) {
                await pool.query(
                    `UPDATE visitgallery AS g SET focus = o.focus
                     FROM unnest($2::int[], $3::text[]) AS o(id, focus)
                     WHERE g.id = o.id AND g.visit_id = $1`,
                    [visitId, entries.map(([k]) => k), entries.map(([, v]) => v)]
                );
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to set featured visit photos:", error);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
}
