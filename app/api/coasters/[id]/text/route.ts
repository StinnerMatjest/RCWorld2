import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { diffFields, getCoasterContext, logChange } from "@/app/lib/changelog";

// Review sections can carry up to three gallery images plus a layout, like the
// park review sections (same "url|cx cy zoom" list and layout names). Added
// in place so existing rows keep working; runs once per process.
let imageColumns: Promise<void> | null = null;
function ensureImageColumns(): Promise<void> {
    if (!imageColumns) {
        imageColumns = pool
            .query(`ALTER TABLE coastertext
                    ADD COLUMN IF NOT EXISTS image_url TEXT,
                    ADD COLUMN IF NOT EXISTS image_layout TEXT`)
            .then(() => undefined)
            .catch((err) => { imageColumns = null; throw err; });
    }
    return imageColumns;
}

// Helper function to resolve slug OR id to a numeric coaster ID
async function resolveCoasterId(identifier: string): Promise<number | null> {
    const numId = Number(identifier);
    if (!Number.isNaN(numId)) {
        return numId;
    }

    // It's a slug! Look it up in the DB.
    const res = await pool.query("SELECT id FROM rollercoasters WHERE slug = $1", [identifier]);
    if (res.rowCount && res.rowCount > 0) {
        return res.rows[0].id;
    }
    return null;
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const coasterId = await resolveCoasterId(id);

    if (!coasterId) {
        return NextResponse.json({ texts: [] });
    }

    try {
        await ensureImageColumns();
        const query = `
  SELECT
    id,
    coaster_id,
    headline,
    text,
    "order",
    is_spoiler AS "isSpoiler",
    image_url AS "imageUrl",
    image_layout AS "imageLayout"
  FROM coastertext
  WHERE coaster_id = $1
  ORDER BY "order" ASC
`;
        const result = await pool.query(query, [coasterId]);
        return NextResponse.json({ texts: result.rows });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json(
            { error: "Failed to fetch coaster text" },
            { status: 500 }
        );
    }
}

// POST & UPDATE
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    revalidateContent();
    const { id } = await context.params;
    const coasterId = await resolveCoasterId(id);

    if (!coasterId) {
        return NextResponse.json({ error: "Invalid coaster ID or slug" }, { status: 400 });
    }

    try {
        const body = await req.json();

        // Reorder array
        if (Array.isArray(body)) {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                for (const entry of body) {
                    await client.query(
                        `UPDATE coastertext SET "order" = $1 WHERE id = $2 AND coaster_id = $3`,
                        [entry.order, entry.id, coasterId]
                    );
                }
                await client.query("COMMIT");
            } catch (err) {
                await client.query("ROLLBACK");
                throw err;
            } finally {
                client.release();
            }
            return NextResponse.json({ success: true });
        }

        const { id: textId, headline, text, isSpoiler } = body;
        const imageUrl: string | null = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl : null;
        const imageLayout: string | null = typeof body.imageLayout === "string" && body.imageLayout.trim() ? body.imageLayout : null;
        if (!headline && !text) {
            return NextResponse.json({ error: "Missing headline or text" }, { status: 400 });
        }
        await ensureImageColumns();

        if (textId) {
            // UPDATE existing
            const oldRes = await pool.query(
                `SELECT * FROM coastertext WHERE id = $1 AND coaster_id = $2`,
                [textId, coasterId]
            );
            const oldRow = oldRes.rows[0];

            const updateRes = await pool.query(
                `UPDATE coastertext SET headline = $1, text = $2, is_spoiler = $3, image_url = $4, image_layout = $5
                 WHERE id = $6 AND coaster_id = $7
                 RETURNING id, coaster_id, headline, text, "order", is_spoiler AS "isSpoiler", image_url AS "imageUrl", image_layout AS "imageLayout"`,
                [headline, text, isSpoiler ?? false, imageUrl, imageLayout, textId, coasterId]
            );

            if (oldRow) {
                const diff = diffFields(
                    oldRow,
                    { headline, text, isSpoiler, imageUrl, imageLayout },
                    { isSpoiler: "is_spoiler", imageUrl: "image_url", imageLayout: "image_layout" }
                );
                if (Object.keys(diff).length > 0) {
                    const ctx = await getCoasterContext(coasterId);
                    logChange({
                        parkId: ctx.parkId,
                        entityType: "coaster_text",
                        entityId: textId,
                        label: ctx.name,
                        action: "update",
                        summary: `Edited "${headline ?? oldRow.headline}" text on ${ctx.name ?? `coaster #${coasterId}`}`,
                        details: diff,
                    });
                }
            }

            return NextResponse.json({ text: updateRes.rows[0] });
        } else {
            // CREATE new
            const maxOrderRes = await pool.query(
                `SELECT COALESCE(MAX("order"), 0) AS max_order FROM coastertext WHERE coaster_id = $1`,
                [coasterId]
            );
            const newOrder = maxOrderRes.rows[0].max_order + 1;

            const insertRes = await pool.query(
                `INSERT INTO coastertext (coaster_id, headline, text, "order", is_spoiler, image_url, image_layout)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, coaster_id, headline, text, "order", is_spoiler AS "isSpoiler", image_url AS "imageUrl", image_layout AS "imageLayout"`,
                [coasterId, headline, text, newOrder, isSpoiler ?? false, imageUrl, imageLayout]
            );

            const ctx = await getCoasterContext(coasterId);
            logChange({
                parkId: ctx.parkId,
                entityType: "coaster_text",
                entityId: insertRes.rows[0]?.id,
                label: ctx.name,
                action: "create",
                summary: `Added "${headline}" text on ${ctx.name ?? `coaster #${coasterId}`}`,
                details: { headline, text, isSpoiler },
            });

            return NextResponse.json({ text: insertRes.rows[0] });
        }
    } catch (error) {
        console.error("Failed to handle coaster text POST:", error);
        return NextResponse.json({ error: "Failed to handle coaster text POST" }, { status: 500 });
    }
}

// DELETE
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    revalidateContent();
    const { id } = await context.params;
    const coasterId = await resolveCoasterId(id);
    const body = await req.json();
    const { textId } = body;

    if (!coasterId) {
        return NextResponse.json({ error: "Invalid coaster ID or slug" }, { status: 400 });
    }

    if (!textId) {
        return NextResponse.json({ error: "Missing textId" }, { status: 400 });
    }

    try {
        const deleteRes = await pool.query(
            `DELETE FROM coastertext WHERE id = $1 AND coaster_id = $2 RETURNING *`,
            [textId, coasterId]
        );

        const deleted = deleteRes.rows[0];
        if (deleted) {
            const ctx = await getCoasterContext(coasterId);
            logChange({
                parkId: ctx.parkId,
                entityType: "coaster_text",
                entityId: textId,
                label: ctx.name,
                action: "delete",
                summary: `Deleted "${deleted.headline}" text on ${ctx.name ?? `coaster #${coasterId}`}`,
                details: { headline: deleted.headline, text: deleted.text },
            });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to delete text" }, { status: 500 });
    }
}