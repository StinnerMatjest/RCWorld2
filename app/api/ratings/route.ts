import { Pool } from "pg";
import { NextResponse } from "next/server";
import { Rating, RatingWarningType } from "@/app/types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET() {
  try {
    const query = `
      SELECT 
        ratings.id AS rating_id,
        ratings.date,
        ratings.visit_start,
        ratings.visit_end,
        ratings.duration,
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
        ratings.park_id,
        parks.id AS park_id,
        parks.name AS park_name,
        parks.imagepath AS park_image,
        COALESCE(
          json_agg(
            json_build_object(
            'id', ratingwarning.id,
            'ratingId', ratingwarning.ratingid,
            'ride', ratingwarning.ride,
            'note', ratingwarning.note,
            'category', ratingwarning.category,
            'severity', ratingwarning.severity
            )
          ) FILTER (WHERE ratingwarning.id IS NOT NULL),
          '[]'
        ) AS warnings
      FROM ratings
      JOIN parks ON ratings.park_id = parks.id
      LEFT JOIN ratingwarning ON ratingwarning.ratingid = ratings.id
      GROUP BY ratings.id, parks.id
      ORDER BY ratings.date DESC;
    `;

    const result = await pool.query(query);

    const ratings: Rating[] = result.rows.map((row) => ({
      id: row.rating_id,
      date: row.date,
      visit_start: row.visit_start,
      visit_end: row.visit_end,
      duration: row.duration,
      park: row.park_name,
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
      imagePath: row.park_image,
      parkId: row.park_id,
      warnings: row.warnings as RatingWarningType[],
    }));

    return NextResponse.json({ ratings }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch ratings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      date,
      parkAppearance,
      parkPracticality,
      bestCoaster,
      coasterDepth,
      waterRides,
      flatridesAndDarkrides,
      food,
      snacksAndDrinks,
      rideOperations,
      parkManagement,
      parkId,
      visitStart,
      visitEnd,
      duration,
    } = body;

    if (
      date === undefined ||
      parkAppearance === undefined ||
      parkPracticality === undefined ||
      bestCoaster === undefined ||
      coasterDepth === undefined ||
      waterRides === undefined ||
      flatridesAndDarkrides === undefined ||
      food === undefined ||
      snacksAndDrinks === undefined ||
      rideOperations === undefined ||
      parkManagement === undefined ||
      parkId === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO ratings (
        date,
        parkappearance,
        parkpracticality,
        bestcoaster,
        coasterdepth,
        waterrides,
        flatridesanddarkrides,
        food,
        snacksanddrinks,
        rideoperations,
        parkmanagement,
        park_id,
        visit_start,
        visit_end,
        duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `;

    const values = [
      date,
      parkAppearance,
      parkPracticality,
      bestCoaster,
      coasterDepth,
      waterRides,
      flatridesAndDarkrides,
      food,
      snacksAndDrinks,
      rideOperations,
      parkManagement,
      parkId,
      visitStart || null,
      visitEnd || null,
      duration || 0,
    ];

    const result = await pool.query(query, values);

    return NextResponse.json(
      { message: "Park rated successfully", ratingId: result.rows[0].id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inserting rating:", error);
    return NextResponse.json(
      { error: "Failed to create rating" },
      { status: 500 }
    );
  }
}