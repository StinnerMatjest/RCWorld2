import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { diffFields, logChange } from "@/app/lib/changelog";

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    revalidateContent();
    try {
        const { id } = await context.params;
        const { description, title } = await req.json();

        // Join through visits to get the park data for the changelog
        const oldResult = await pool.query(
            `SELECT vg.*, p.name AS park_name, p.id AS park_id 
             FROM visitgallery vg 
             LEFT JOIN visits v ON vg.visit_id = v.id 
             LEFT JOIN parks p ON v.park_id = p.id 
             WHERE vg.id = $1`,
            [id]
        );
        const oldRow = oldResult.rows[0];

        await pool.query(
            `UPDATE visitgallery SET description = $1, title = $2 WHERE id = $3`,
            [description, title, id]
        );

if (oldRow) {
            const diff = diffFields(oldRow, { description, title });
            if (Object.keys(diff).length > 0) {
                logChange({
                    parkId: oldRow.park_id,
                    entityType: "image",
                    entityId: Number(id),
                    label: oldRow.park_name,
                    action: "update",
                    summary: `Updated image "${title ?? oldRow.title}" ${Object.keys(diff).join(", ")}`,
                    details: diff,
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update description and title", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}