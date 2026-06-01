import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const { description, title } = await req.json();

        await pool.query(
            `UPDATE parkgallery SET description = $1, title = $2 WHERE id = $3`,
            [description, title, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update description and title", error);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}