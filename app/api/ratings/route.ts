import { Pool } from "pg";
import { NextResponse } from "next/server";
import { Rating } from "@/app/page";


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
        ratings.parkAppearance AS "parkappearance",
        ratings.bestCoaster AS "bestcoaster",
        ratings.waterRides AS "waterrides",
        ratings.rideLineup AS "rideLineup",
        ratings.food,
        ratings.snacksAndDrinks AS "snacksanddrinks",
        ratings.parkPracticality AS "parkpracticality",
        ratings.rideOperations AS "rideoperations",
        ratings.parkManagement AS "parkmanagement",
        ratings.overall,
        ratings.park_id,
        parks.id AS park_id,
        parks.name AS park_name,
        parks.imagepath AS park_image
      FROM ratings
      JOIN parks ON ratings.park_id = parks.id
    `;

    const result = await pool.query(query);

    const ratings: Rating[] = result.rows.map((row) => ({
      id: row.rating_id,
      date: row.date,
      park: row.park_name,
      parkAppearance: row.parkappearance,
      bestCoaster: row.bestcoaster,
      waterRides: row.waterrides,
      rideLineup: row.rideLineup,
      food: row.food,
      snacksAndDrinks: row.snacksanddrinks,
      parkPracticality: row.parkpracticality,
      rideOperations: row.rideoperations,
      parkManagement: row.parkmanagement,
      overall: row.overall,
      imagePath: row.park_image,
      parkId: row.park_id,
    }));

    console.log(ratings);

    return NextResponse.json({ ratings }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);

    return NextResponse.json(
      { error: "Failed to fetch ratings" },
      { status: 500 }
    );
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received body:', body);

    const {date, parkAppearance, bestCoaster, waterRides, rideLineup, food, snacksAndDrinks, parkPracticality, rideOperations, parkManagement, overall, parkId} = body;

    if (date === undefined || parkAppearance === undefined || bestCoaster === undefined || waterRides === undefined || rideLineup === undefined || food === undefined ||
        snacksAndDrinks === undefined || parkPracticality === undefined || rideOperations === undefined || parkManagement === undefined || overall === undefined || parkId === undefined
    )
      {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO ratings (
        date,
        parkappearance,
        bestcoaster,
        waterrides,
        rideLineup,
        food,
        snacksanddrinks,
        parkpracticality,
        rideoperations,
        parkmanagement,
        overall,
        park_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;

    const values = [date, parkAppearance, bestCoaster, waterRides, rideLineup, food, snacksAndDrinks, parkPracticality, rideOperations, parkManagement, overall, parkId];

    const result = await pool.query(query, values);

    const newRatingId = result.rows[0].id;

    return NextResponse.json(
      { message: "Park rated successfully", ratingId: newRatingId },
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
