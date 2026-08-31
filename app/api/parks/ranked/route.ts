import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET() {
  const result = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (park_id)
        park_id, overall, bestcoaster, parkappearance, coasterdepth,
        waterrides, flatridesanddarkrides, food, snacksanddrinks,
        parkpracticality, rideoperations, parkmanagement, date
      FROM ratings
      -- REMOVED: WHERE published = TRUE (This allows draft ratings to show up)
      ORDER BY park_id, date DESC
    )
    SELECT
      p.id, p.name, p.country, p.continent, p.slug, p.imagepath,
      COALESCE(l.overall, 0) AS overall,
      COALESCE(l.bestcoaster, 0) AS "bestCoaster",
      COALESCE(l.parkappearance, 0) AS "parkAppearance",
      COALESCE(l.coasterdepth, 0) AS "coasterDepth",
      COALESCE(l.waterrides, 0) AS "waterRides",
      COALESCE(l.flatridesanddarkrides, 0) AS "flatRidesAndDarkRides",
      COALESCE(l.food, 0) AS food,
      COALESCE(l.snacksanddrinks, 0) AS "snacksAndDrinks",
      COALESCE(l.parkpracticality, 0) AS "parkPracticality",
      COALESCE(l.rideoperations, 0) AS "rideOperations",
      COALESCE(l.parkmanagement, 0) AS "parkManagement",
      l.date AS "lastVisitDate"
    FROM parks p
    LEFT JOIN latest l ON l.park_id = p.id
    ORDER BY l.overall DESC NULLS LAST
  `);
  return NextResponse.json({ parks: result.rows });
}