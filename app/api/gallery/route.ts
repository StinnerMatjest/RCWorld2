import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        pg.id, 
        pg.path, 
        pg.title, 
        p.name AS park_name,
        p.slug AS park_slug
      FROM parkgallery pg
      LEFT JOIN parks p ON pg.park_id = p.id
      ORDER BY pg.id DESC
    `);

    return NextResponse.json({ images: result.rows }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch gallery images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}