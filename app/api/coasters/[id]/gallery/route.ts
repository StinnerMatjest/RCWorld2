import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(
  req: NextRequest,
) {
  const url = new URL(req.url);
  const coasterName = url.searchParams.get("name") || "";
  const parkId = url.searchParams.get("parkId");

  if (!parkId) {
    return NextResponse.json({ error: "Missing parkId" }, { status: 400 });
  }

  try {
    // Fetch ALL headers
    const headerRes = await pool.query(
      `
      SELECT id, title, path, description
      FROM parkgallery
      WHERE park_id = $1 AND title ILIKE $2
      ORDER BY id DESC
      `,
      [parkId, `%${coasterName}%HEADER%`]
    );

    let activeHeader = headerRes.rows[0] || null;
    let allActiveHeaders = headerRes.rows;

    // Fallback to any coaster image if no explicit header exists
    if (!activeHeader) {
      const fallbackRes = await pool.query(
        `
        SELECT id, title, path, description
        FROM parkgallery
        WHERE park_id = $1 AND title ILIKE $2
        ORDER BY id ASC
        LIMIT 1
        `,
        [parkId, `%${coasterName}%`]
      );
      activeHeader = fallbackRes.rows[0] || null;
    }

    const headerImage = activeHeader?.path || null;

    // Fetch the rest of the gallery (excluding HEADER ONLY)
    const galleryRes = await pool.query(
      `
      SELECT id, title, path, description
      FROM parkgallery
      WHERE park_id = $1 
        AND title ILIKE $2
        AND title NOT ILIKE $3
      ORDER BY id ASC
      `,
      [parkId, `%${coasterName}%`, `%HEADER ONLY%`]
    );

    const gallery = galleryRes.rows;

    return NextResponse.json({ headerImage, activeHeader, allActiveHeaders, gallery });
  } catch (error) {
    console.error("Failed to fetch coaster gallery images", error);
    return NextResponse.json(
      { error: "Failed to fetch coaster gallery images" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const { title } = await req.json();

    const result = await pool.query(
      "UPDATE parkgallery SET title = $1 WHERE id = $2 RETURNING *",
      [title, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;

    await pool.query("DELETE FROM parkgallery WHERE id = $1", [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}