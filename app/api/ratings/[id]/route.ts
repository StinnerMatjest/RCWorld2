import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ratingId } = await context.params;
    const body = await request.json();

    // SCENARIO A: Full Rating Edit (Check if category data exists in payload)
    if (body.parkAppearance !== undefined) {
      const {
        date, parkAppearance, parkPracticality, bestCoaster, coasterDepth,
        waterRides, flatridesAndDarkrides, food, snacksAndDrinks,
        rideOperations, parkManagement, visitStart, visitEnd, duration
      } = body;

      const query = `
        UPDATE ratings SET 
          date = $1, parkappearance = $2, parkpracticality = $3, bestcoaster = $4,
          coasterdepth = $5, waterrides = $6, flatridesanddarkrides = $7, food = $8,
          snacksanddrinks = $9, rideoperations = $10, parkmanagement = $11,
          visit_start = $12, visit_end = $13, duration = $14
        WHERE id = $15
        RETURNING id
      `;

      const values = [
        date, parkAppearance, parkPracticality, bestCoaster, coasterDepth,
        waterRides, flatridesAndDarkrides, food, snacksAndDrinks,
        rideOperations, parkManagement, visitStart || null, visitEnd || null, duration || 0,
        ratingId
      ];

      const result = await pool.query(query, values);
      if (result.rowCount === 0) return NextResponse.json({ error: "Rating not found" }, { status: 404 });

      return NextResponse.json({ message: "Rating updated successfully" }, { status: 200 });
    }

    // SCENARIO B: Quick Publish Toggle
    else if (typeof body.published === "boolean") {
      const query = `UPDATE ratings SET published = $1 WHERE id = $2 RETURNING id`;
      const result = await pool.query(query, [body.published, ratingId]);

      if (result.rowCount === 0) return NextResponse.json({ error: "Rating not found" }, { status: 404 });
      return NextResponse.json({ message: "Rating published successfully" }, { status: 200 });
    }

    // Fallback
    else {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

  } catch (error) {
    console.error("Failed to update rating:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}