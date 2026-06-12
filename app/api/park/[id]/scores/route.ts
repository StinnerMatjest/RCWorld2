import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const isNumeric = /^\d+$/.test(id);

  const result = await pool.query(`
    SELECT
      ROUND(AVG(r.overall)::numeric, 1)               AS overall,
      ROUND(AVG(r.bestcoaster)::numeric, 1)            AS "bestCoaster",
      ROUND(AVG(r.parkappearance)::numeric, 1)         AS "parkAppearance",
      ROUND(AVG(r.coasterdepth)::numeric, 1)           AS "coasterDepth",
      ROUND(AVG(r.waterrides)::numeric, 1)             AS "waterRides",
      ROUND(AVG(r.flatridesanddarkrides)::numeric, 1)  AS "flatRidesAndDarkRides",
      ROUND(AVG(r.food)::numeric, 1)                   AS food,
      ROUND(AVG(r.snacksanddrinks)::numeric, 1)        AS "snacksAndDrinks",
      ROUND(AVG(r.parkpracticality)::numeric, 1)       AS "parkPracticality",
      ROUND(AVG(r.rideoperations)::numeric, 1)         AS "rideOperations",
      ROUND(AVG(r.parkmanagement)::numeric, 1)         AS "parkManagement",
      COUNT(r.id)                                      AS "visitCount"
    FROM ratings r
    JOIN parks p ON p.id = r.park_id
    WHERE r.published = TRUE
      AND (${isNumeric ? "p.id = $1" : "p.slug = $1"})
  `, [isNumeric ? Number(id) : id]);

  const row = result.rows[0];
  if (!row || row.visitCount === "0") return NextResponse.json(null);
  return NextResponse.json(row);
}
