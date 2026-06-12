// app/api/coasters/[id]/highlights/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { revalidateContent } from "@/app/lib/revalidate";
import { getCoasterContext, logChange } from "@/app/lib/changelog";


export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
    const { id } = await context.params;
    const coasterId = Number(id);

    try {
        const body = await req.json(); // Expecting array: [{ category: "Airtime", severity: "positive" }, ...]
        
        if (!Array.isArray(body)) {
            return NextResponse.json({ error: "Body must be an array" }, { status: 400 });
        }

        const oldResult = await pool.query(
            `SELECT category, severity FROM rollercoasterhighlights WHERE coaster_id = $1 ORDER BY category, severity`,
            [coasterId]
        );
        const oldList = oldResult.rows;

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // 1. Wipe clean existing highlights for this coaster
            // (We rely on the frontend to send us the COMPLETE list of what should exist)
            await client.query("DELETE FROM rollercoasterhighlights WHERE coaster_id = $1", [coasterId]);

            // 2. Insert the new rows
            for (const item of body) {
                // Skip empty rows to keep DB clean
                if (!item.category || item.category.trim() === "") continue;

                await client.query(
                    `INSERT INTO rollercoasterhighlights (coaster_id, category, severity) 
                     VALUES ($1, $2, $3)`,
                    [coasterId, item.category, item.severity]
                );
            }

            await client.query("COMMIT");
            
            // 3. Fetch the fresh list to return to frontend
            const result = await client.query(
                "SELECT * FROM rollercoasterhighlights WHERE coaster_id = $1",
                [coasterId]
            );

            const newList = result.rows
                .map((r) => ({ category: r.category, severity: r.severity }))
                .sort((a, b) => a.category.localeCompare(b.category) || String(a.severity).localeCompare(String(b.severity)));
            if (JSON.stringify(oldList) !== JSON.stringify(newList)) {
                const ctx = await getCoasterContext(coasterId);
                logChange({
                    parkId: ctx.parkId,
                    entityType: "coaster_highlight",
                    entityId: coasterId,
                    label: ctx.name,
                    action: "update",
                    summary: `Updated highlights for ${ctx.name ?? `coaster #${coasterId}`} (${newList.length})`,
                    details: { old: oldList, new: newList },
                });
            }

            return NextResponse.json({ highlights: result.rows, success: true });

        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error("Failed to save highlights:", error);
        return NextResponse.json(
            { error: "Failed to save highlights", details: error.message }, 
            { status: 500 }
        );
    }
}