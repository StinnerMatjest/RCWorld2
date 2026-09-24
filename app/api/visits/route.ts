import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

// Every dated rating is a park visit — powers the /about timeline. Unpublished
// ratings are included (the visit happened, the score exists) and the timeline
// shows them as "review coming soon" instead of linking to the review.
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        v.id                       AS "ratingId",
        v.date,
        v.overall,
        COALESCE(v.published, FALSE) AS published,
        p.id                       AS "parkId",
        p.name,
        p.country,
        p.slug,
        p.imagepath,
        p.header_focus             AS "headerFocus",
        ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY v.date ASC)::int AS "visitNumber",
        COUNT(*)    OVER (PARTITION BY p.id)::int                      AS "totalVisits"
      FROM visits v
      JOIN parks p ON p.id = v.park_id
      WHERE v.date IS NOT NULL
      ORDER BY v.date DESC, v.id DESC
    `);
    return NextResponse.json(
      { visits: result.rows },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error("visits GET:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}