import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET(req: NextRequest, context: { params: { id: string } }) {
    const { id } = context.params;
    const url = new URL(req.url);
    const coasterName = url.searchParams.get("name") || "";

    try {
        const res = await pool.query(
            `
      SELECT id, park_id, title, path, description
      FROM parkgallery
      WHERE title ILIKE $1
      ORDER BY id ASC
      `,
            [`%${coasterName}%`]
        );

        return NextResponse.json({ gallery: res.rows });
    } catch (error) {
        console.error("Failed to fetch coaster gallery images", error);
        return NextResponse.json(
            { error: "Failed to fetch coaster gallery images" },
            { status: 500 }
        );
    }
}
