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
    const headerRes = await pool.query(
      `
      SELECT id, path
      FROM parkgallery
      WHERE park_id = $1 AND title ILIKE $2
      ORDER BY id ASC
      LIMIT 1
      `,
      [parkId, `%${coasterName}%HEADER%`]
    );

    let headerImage = headerRes.rows[0]?.path;

    if (!headerImage) {
      const fallbackRes = await pool.query(
        `
        SELECT id, path
        FROM parkgallery
        WHERE park_id = $1 AND title ILIKE $2
        ORDER BY id ASC
        LIMIT 1
        `,
        [parkId, `%${coasterName}%`]
      );
      headerImage = fallbackRes.rows[0]?.path || null;
    }

    const galleryRes = await pool.query(
      `
      SELECT id, title, path, description
      FROM parkgallery
      WHERE park_id = $1 AND title ILIKE $2
      ORDER BY id ASC
      `,
      [parkId, `%${coasterName}%`]
    );

    const gallery = galleryRes.rows;

    return NextResponse.json({ headerImage, gallery });
  } catch (error) {
    console.error("Failed to fetch coaster gallery images", error);
    return NextResponse.json(
      { error: "Failed to fetch coaster gallery images" },
      { status: 500 }
    );
  }
}
