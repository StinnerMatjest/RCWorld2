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

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: parkId } = await context.params; // Resolve params in Next.js 15
    const body = await req.json();
    const { name, year, manufacturer, model, scale, haveridden, rcdbpath } = body;

    console.log("Adding coaster to park ID:", parkId, name, year, manufacturer, model);

    if (!name || !year || !manufacturer || !model || !scale || haveridden === undefined || !rcdbpath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const query = `
      INSERT INTO rollercoasters (park_id, name, year, manufacturer, model, scale, haveridden, rcdbpath)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      parkId,
      name,
      year,
      manufacturer,
      model,
      scale,
      haveridden,
      rcdbpath,
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Database insert error:", error);
    return NextResponse.json({ error: "Failed to add roller coaster" }, { status: 500 });
  }
}
