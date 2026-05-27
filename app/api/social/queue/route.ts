import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function GET() {
  const result = await pool.query(
    `SELECT * FROM social_posts WHERE status IN ('draft','scheduled') ORDER BY created_at DESC`
  );
  return NextResponse.json({ posts: result.rows });
}

export async function POST(req: Request) {
  const { caption, hashtags, image_url, park_id, park_name, category } = await req.json();
  const row = await pool.query(
    `INSERT INTO social_posts (caption, hashtags, image_url, park_id, park_name, category)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [caption || "", hashtags || "", image_url, park_id, park_name, category || null]
  );
  return NextResponse.json({ post: row.rows[0] });
}
