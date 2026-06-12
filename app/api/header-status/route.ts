import { pool } from "@/app/lib/db";
import { NextResponse } from "next/server";

// Lightweight payload for the site header: upcoming booked trip dates and
// the names of parks with unpublished reviews. Replaces the header fetching
// the full trips + ratings tables on every page load.
export async function GET() {
  try {
    const [tripsResult, parksResult] = await Promise.all([
      pool.query(
        `SELECT start_date AS "startDate" FROM trips WHERE status = 'booked'`
      ),
      pool.query(
        `SELECT DISTINCT parks.name
         FROM ratings
         JOIN parks ON ratings.park_id = parks.id
         WHERE ratings.published = false
         ORDER BY parks.name`
      ),
    ]);

    return NextResponse.json(
      {
        tripStartDates: tripsResult.rows.map((r) => r.startDate),
        underReviewParks: parksResult.rows.map((r) => r.name),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch header status" }, { status: 500 });
  }
}
