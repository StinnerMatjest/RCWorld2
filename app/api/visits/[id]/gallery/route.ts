import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { getParkName, logChange } from "@/app/lib/changelog";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const visitId = parseInt(id, 10);

        if (isNaN(visitId)) return NextResponse.json({ gallery: [] });

        const res = await pool.query(
            `SELECT id, title, path, description 
       FROM visitgallery 
       WHERE visit_id = $1 
       ORDER BY id ASC`,
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