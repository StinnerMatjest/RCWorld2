import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const parkId = params.id; // Extract the park ID from the URL parameters

  try {
    const query = `
      SELECT
        id,
        name,
        continent,
        country,
        city,
        imagepath
      FROM parks
      WHERE id = $1
    `;
    const result = await pool.query(query, [parkId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    const park = result.rows[0]; // Get the first result (there should only be one)
    return NextResponse.json(park, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch park" }, { status: 500 });
  }
}
