import { pool } from "@/app/lib/db";
import { revalidateContent } from "@/app/lib/revalidate";
import { getParkName, logChange } from "@/app/lib/changelog";
import { seedParkTextsFromChecklist } from "@/app/lib/checklistNotes";
import { NextResponse } from "next/server";
import { Visit, RatingWarningType } from "@/app/types";

export async function GET() {
  try {
    const query = `
      SELECT 
        visits.id AS rating_id,
        visits.date,
        visits.visit_start,
        visits.visit_end,
        visits.duration,
        visits.parkAppearance AS "parkappearance",
        visits.bestCoaster AS "bestcoaster",
        visits.coasterDepth AS "coasterdepth",
        visits.waterRides AS "waterrides",
        visits.flatridesAndDarkrides AS "flatridesanddarkrides",
        visits.food,
        visits.snacksAndDrinks AS "snacksanddrinks",
        visits.parkPracticality AS "parkpracticality",
        visits.rideOperations AS "rideoperations",
        visits.parkManagement AS "parkmanagement",
        visits.overall,
        visits.published,
        visits.park_id,
        parks.id AS park_id,
        parks.name AS park_name,
        parks.imagepath AS park_image,
        COALESCE(
          json_agg(
            json_build_object(
            'id', ratingwarning.id,
            'ratingId', ratingwarning.visit_id,
            'ride', ratingwarning.ride,
            'note', ratingwarning.note,
            'category', ratingwarning.category,
            'severity', ratingwarning.severity
            )
          ) FILTER (WHERE ratingwarning.id IS NOT NULL),
          '[]'
        ) AS warnings
      FROM visits
      JOIN parks ON visits.park_id = parks.id
      LEFT JOIN ratingwarning ON ratingwarning.visit_id = visits.id
      GROUP BY visits.id, parks.id
      ORDER BY visits.date DESC;
    `;

    const result = await pool.query(query);

    const ratings: Visit[] = result.rows.map((row) => ({
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
      published: row.published,
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
  revalidateContent();
  try {
    const body = await request.json();
    console.log("Received body:", body);

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
      published,
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
      INSERT INTO visits (
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
        duration,
        published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
      published ?? false,
    ];

    const result = await pool.query(query, values);

    const newRatingId = result.rows[0].id;

    await seedParkTextsFromChecklist({ ratingId: newRatingId, parkId, checklistSlug: body.checklistSlug ?? null });

    logChange({
      parkId,
      entityType: "rating",
      entityId: newRatingId,
      label: await getParkName(parkId),
      action: "create",
      summary: `New rating${published ? " (published)" : ""}`,
      details: {
        date, parkAppearance, parkPracticality, bestCoaster, coasterDepth,
        waterRides, flatridesAndDarkrides, food, snacksAndDrinks,
        rideOperations, parkManagement, published: published ?? false,
      },
    });

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