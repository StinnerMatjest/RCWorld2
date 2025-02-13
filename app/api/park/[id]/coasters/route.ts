import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: parkId } = await context.params; // Resolve params in Next.js 15

    console.log("Fetching coasters for park ID:", parkId);

    const query = `
      SELECT 
        id,
        name,
        year,
        manufacturer,
        model,
        scale,
        haveridden,
        rcdbpath
      FROM rollercoasters
      WHERE park_id = $1
    `;

    const result = await pool.query(query, [parkId]);

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch roller coasters" }, { status: 500 });
  }
}
