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
    const { id: parkId } = await context.params;
    const searchParams = req.nextUrl.searchParams;
    const dateParam = searchParams.get("date");

    let query: string;
    let values: string[];

    if (dateParam) {
      query = `
        SELECT 
          ratings.id AS rating_id,
          ratings.date,
          ratings.parkAppearance AS "parkappearance",
          ratings.bestCoaster AS "bestcoaster",
          ratings.coasterDepth AS "coasterdepth",
          ratings.waterRides AS "waterrides",
          ratings.flatridesAndDarkrides AS "flatridesanddarkrides",
          ratings.food,
          ratings.snacksAndDrinks AS "snacksanddrinks",
          ratings.parkPracticality AS "parkpracticality",
          ratings.rideOperations AS "rideoperations",
          ratings.parkManagement AS "parkmanagement",
          ratings.overall,
          ratings.park_id
        FROM ratings
        WHERE park_id = $1 AND date = $2
        LIMIT 1
      `;
      values = [parkId, dateParam];
    } else {
      query = `
        SELECT 
          ratings.id AS rating_id,
          ratings.date,
          ratings.parkAppearance AS "parkappearance",
          ratings.bestCoaster AS "bestcoaster",
          ratings.coasterDepth AS "coasterdepth",
          ratings.waterRides AS "waterrides",
          ratings.flatridesAndDarkrides AS "flatridesanddarkrides",
          ratings.food,
          ratings.snacksAndDrinks AS "snacksanddrinks",
          ratings.parkPracticality AS "parkpracticality",
          ratings.rideOperations AS "rideoperations",
          ratings.parkManagement AS "parkmanagement",
          ratings.overall,
          ratings.park_id
        FROM ratings
        WHERE park_id = $1
        ORDER BY date DESC
      `;
      values = [parkId];
    }

    const result = await pool.query(query, values);

    const ratings = result.rows.map((row) => ({
      id: row.rating_id,
      date: row.date,
      parkAppearance: row.parkappearance,
      bestCoaster: row.bestcoaster,
      coasterDepth: row.coasterdepth,
      waterRides: row.waterrides,
      flatridesAndDarkrides: row.flatridesanddarkrides,
      food: row.food,
      snacksAndDrinks: row.snacksanddrinks,
      parkPracticality: row.parkpracticality,
      rideOperations: row.rideoperations,
      parkManagement: row.parkmanagement,
      overall: row.overall,
      parkId: row.park_id,
    }));

    // If filtering by date, return a single object
    if (dateParam) {
      if (ratings.length === 0) {
        return NextResponse.json(
          { error: "No rating found for that date." },
          { status: 404 }
        );
      }
      return NextResponse.json(ratings[0], { status: 200 });
    }

    // Else return full list
    return NextResponse.json({ ratings }, { status: 200 });
  } catch (error) {
    console.error("Error fetching park ratings:", error);
    return NextResponse.json(
      { error: "Failed to fetch park ratings" },
      { status: 500 }
    );
  }
}
