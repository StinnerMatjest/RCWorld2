import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET(
    req: Request,
    context: { params: { id: string } }
) {
    const { id } = await context.params;
    const coasterId = Number(id);

    try {
        const query = `
            SELECT 
                id,
                coaster_id,
                headline,
                text
            FROM coastertext
            WHERE coaster_id = $1
            ORDER BY id ASC
        `;

        const result = await pool.query(query, [coasterId]);

        // Return all text entries for this coaster
        return NextResponse.json({ texts: result.rows });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json(
            { error: "Failed to fetch coaster text" },
            { status: 500 }
        );
    }
}
