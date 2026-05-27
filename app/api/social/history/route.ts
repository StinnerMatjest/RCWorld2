import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function GET() {
  const [posts, stats] = await Promise.all([
    pool.query(`
      SELECT id, caption, hashtags, image_url, park_name, category, reasoning,
             published_to, published_at, fb_post_id, ig_post_id
      FROM social_posts
      WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT 100
    `),
    pool.query(`
      SELECT
        COUNT(*)                                                    AS total,
        COUNT(*) FILTER (WHERE 'facebook'  = ANY(published_to))    AS facebook,
        COUNT(*) FILTER (WHERE 'instagram' = ANY(published_to))    AS instagram,
        COUNT(*) FILTER (WHERE array_length(published_to,1) >= 2)  AS both,
        COUNT(DISTINCT park_name)                                   AS unique_parks
      FROM social_posts WHERE status = 'published'
    `),
  ]);

  const topParks = await pool.query(`
    SELECT park_name, COUNT(*) AS count
    FROM social_posts WHERE status = 'published' AND park_name IS NOT NULL
    GROUP BY park_name ORDER BY count DESC LIMIT 5
  `);

  return NextResponse.json({
    posts: posts.rows,
    stats: stats.rows[0],
    topParks: topParks.rows,
  });
}
