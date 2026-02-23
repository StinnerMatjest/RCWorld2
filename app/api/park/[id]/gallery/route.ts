import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  console.log("id from params:", id);

  try {
    const res = await pool.query(
      `SELECT id, title, path, description 
       FROM parkgallery 
       WHERE park_id = $1 
         AND title NOT ILIKE $2 
       ORDER BY id ASC`,
      [id, '%HEADER ONLY%']
    );
    console.log("Query result rows:", res.rows);

    return NextResponse.json({ gallery: res.rows });
  } catch (error) {
    console.error("Failed to fetch gallery images", error);
    return NextResponse.json({ error: "Failed to fetch gallery images" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { title, path, description, parkId } = await req.json();

  if (
    typeof title !== "string" ||
    typeof path !== "string" ||
    typeof description !== "string" ||
    typeof parkId !== "number"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields" },
      { status: 400 }
    );
  }

  try {
    const query = `
      INSERT INTO parkgallery (title, path, description, park_id)
      VALUES ($1, $2, $3, $4)
    `;
    await pool.query(query, [title, path, description, parkId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save gallery image", error);
    return NextResponse.json(
      { error: "Failed to save gallery image" },
      { status: 500 }
    );
  }
}