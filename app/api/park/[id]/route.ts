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
    const { id: parkId } = await context.params;  // Wait for the params promise to resolve - NEEDED FOR NEXT 15

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

    const park = result.rows[0];
    return NextResponse.json(park, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch park" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: parkId } = await context.params;
    const body = await req.json();
    const { imagepath } = body;

    if (!imagepath) {
      return NextResponse.json({ error: "Image path is required" }, { status: 400 });
    }

    const query = `
      UPDATE parks 
      SET imagepath = $1 
      WHERE id = $2 
      RETURNING *;
    `;
    
    const result = await pool.query(query, [imagepath, parkId]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json({ error: "Failed to update park image" }, { status: 500 });
  }
}
