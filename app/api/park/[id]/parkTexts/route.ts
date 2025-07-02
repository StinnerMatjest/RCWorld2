import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const parkId = context.params.id;

  try {
    const result = await pool.query(
      `
      SELECT category, text
      FROM parktexts
      WHERE park_id = $1
      `,
      [parkId]
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("DB error:", error);
    return NextResponse.json(
      { error: "Failed to fetch park ratings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const parkId = parseInt(segments[segments.length - 2], 10);

  const { category, text } = await req.json();

  if (!category || !text || isNaN(parkId)) {
    return NextResponse.json({ error: "Missing or invalid data" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO parktexts (park_id, category, text)
      VALUES ($1, $2, $3)
      RETURNING *;
      `,
      [parkId, category, text]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Database insert error:", error);

    return NextResponse.json(
      { error: "Failed to create park text" },
      { status: 500 }
    );
  }
}


export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const parkId = parseInt(segments[segments.length - 2], 10);

  const { category, text } = await req.json();

  if (!category || !text || isNaN(parkId)) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `
      UPDATE parktexts
      SET text = $1
      WHERE park_id = $2 AND category = $3
      RETURNING *;
      `,
      [text, parkId, category]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Text entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json(
      { error: "Failed to update park text" },
      { status: 500 }
    );
  }
}


