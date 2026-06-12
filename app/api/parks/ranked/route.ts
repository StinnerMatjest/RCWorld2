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
      WHERE published = TRUE
      ORDER BY park_id, date DESC
    )
    SELECT
      p.id, p.name, p.country, p.continent, p.slug, p.imagepath,
      l.overall,
      l.bestcoaster            AS "bestCoaster",
      l.parkappearance         AS "parkAppearance",
      l.coasterdepth           AS "coasterDepth",
      l.waterrides             AS "waterRides",
      l.flatridesanddarkrides  AS "flatRidesAndDarkRides",
      l.food,
      l.snacksanddrinks        AS "snacksAndDrinks",
      l.parkpracticality       AS "parkPracticality",
      l.rideoperations         AS "rideOperations",
      l.parkmanagement         AS "parkManagement",
      l.date                   AS "lastVisitDate"
    FROM parks p
    INNER JOIN latest l ON l.park_id = p.id
    ORDER BY l.overall DESC NULLS LAST
  `);
  return NextResponse.json({ parks: result.rows });
}
