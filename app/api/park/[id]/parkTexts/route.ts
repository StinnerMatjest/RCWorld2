import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ratingId = searchParams.get("ratingId");

    if (!ratingId) {
      return NextResponse.json({ error: "ratingId is required" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT category, text, image_url AS "imageUrl", rating_id AS "ratingId"
       FROM parktexts
       WHERE rating_id = $1`,
      [ratingId]
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("DB error:", error);
    return NextResponse.json({ error: "Failed to fetch park texts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { category, text, ratingId, imageUrl } = await req.json();

  if (!category || !ratingId) {
    return NextResponse.json({ error: "Missing or invalid data" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO parktexts (rating_id, category, text, image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING category, text, image_url AS "imageUrl", rating_id AS "ratingId"`,
      [ratingId, category, text ?? "", imageUrl ?? null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Database insert error:", error);
    return NextResponse.json({ error: "Failed to create park text" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { category, text, ratingId, imageUrl } = await req.json();

  if (!category || !ratingId) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE parktexts
       SET text = $1, image_url = $2
       WHERE rating_id = $3 AND category = $4
       RETURNING category, text, image_url AS "imageUrl", rating_id AS "ratingId"`,
      [text ?? "", imageUrl ?? null, ratingId, category]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Text entry not found for this specific visit" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json({ error: "Failed to update park text" }, { status: 500 });
  }
}
