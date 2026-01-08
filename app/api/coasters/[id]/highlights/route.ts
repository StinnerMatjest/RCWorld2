// app/api/coasters/[id]/highlights/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const coasterId = Number(id);

    try {
        const body = await req.json(); // Expecting array: [{ category: "Airtime", severity: "positive" }, ...]
        
        if (!Array.isArray(body)) {
            return NextResponse.json({ error: "Body must be an array" }, { status: 400 });
        }

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