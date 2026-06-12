import { pool } from "@/app/lib/db";
import { revalidateContent } from "@/app/lib/revalidate";
import { diffFields, describeDiff, logChange } from "@/app/lib/changelog";
import { NextRequest, NextResponse } from "next/server";


export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  try {
    const { id: ratingId } = await context.params;
    const body = await request.json();

    const oldResult = await pool.query(
      `SELECT r.*, p.name AS park_name FROM ratings r JOIN parks p ON p.id = r.park_id WHERE r.id = $1`,
      [ratingId]
    );
    const oldRow = oldResult.rows[0];

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

      if (oldRow) {
        const diff = diffFields(
          oldRow,
          {
            date, parkAppearance, parkPracticality, bestCoaster, coasterDepth,
            waterRides, flatridesAndDarkrides, food, snacksAndDrinks,
            rideOperations, parkManagement,
            visitStart: visitStart || null, visitEnd: visitEnd || null,
            duration: duration || 0,
          },
          { visitStart: "visit_start", visitEnd: "visit_end" }
        );
        if (Object.keys(diff).length > 0) {
          logChange({
            parkId: oldRow.park_id,
            entityType: "rating",
            entityId: Number(ratingId),
            label: oldRow.park_name,
            action: "update",
            summary: `Updated rating: ${describeDiff(diff)}`,
            details: diff,
          });
        }
      }

      return NextResponse.json({ message: "Rating updated successfully" }, { status: 200 });
    }

    // SCENARIO B: Quick Publish Toggle
    else if (typeof body.published === "boolean") {
      const query = `UPDATE ratings SET published = $1 WHERE id = $2 RETURNING id`;
      const result = await pool.query(query, [body.published, ratingId]);

      if (result.rowCount === 0) return NextResponse.json({ error: "Rating not found" }, { status: 404 });

      if (oldRow && oldRow.published !== body.published) {
        logChange({
          parkId: oldRow.park_id,
          entityType: "rating",
          entityId: Number(ratingId),
          label: oldRow.park_name,
          action: body.published ? "publish" : "unpublish",
          summary: body.published ? "Published rating" : "Unpublished rating",
          details: { published: { old: oldRow.published, new: body.published } },
        });
      }

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