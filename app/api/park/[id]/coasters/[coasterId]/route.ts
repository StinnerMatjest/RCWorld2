import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { diffFields, describeDiff, logChange } from "@/app/lib/changelog";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; coasterId: string }> }
) {
  const { id: parkId, coasterId } = await context.params;

  const result = await pool.query(
    `
    SELECT
      id,
      name,
      year,
      manufacturer_id,
      ride_model_id AS "rideModelId",
      model,
      scale,
      haveridden,
      isbestcoaster,
      rating,
      ridecount AS "rideCount",
      slug
    FROM rollercoasters
    WHERE id = $1 AND park_id = $2;
    `,
    [coasterId, parkId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: `Park: ${parkId} does not contain a coaster with ID: ${coasterId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(result.rows[0], { status: 200 });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; coasterId: string }> }
) {
  revalidateContent();
  try {
    const { id: parkId, coasterId } = await context.params;
    const body = await req.json();
    const {
      name,
      year,
      manufacturerId,
      rideModelId, // NEW
      model,
      scale,
      haveridden,
      isbestcoaster,
      rating,
      rideCount,
    } = body;

    if (
      !name ||
      !year ||
      !manufacturerId ||
      !model ||
      !scale ||
      haveridden === undefined ||
      isbestcoaster === undefined ||
      rating === undefined ||
      rideCount === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const oldResult = await pool.query(
      `SELECT * FROM rollercoasters WHERE id = $1 AND park_id = $2`,
      [coasterId, parkId]
    );
    const oldRow = oldResult.rows[0];

    const ratingInitial = haveridden
      ? Number.isNaN(Number(rating)) ? 0 : Number(rating)
      : 0;

    const rideCountInitial = haveridden
      ? Number.isNaN(Number(rideCount)) ? 0 : Number(rideCount)
      : 0;

    let generatedSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // Check if the slug exists on a another coaster
    const slugCheck = await pool.query("SELECT id FROM rollercoasters WHERE slug = $1 AND id != $2", [generatedSlug, coasterId]);
    if (slugCheck.rowCount && slugCheck.rowCount > 0) {
      const parkRes = await pool.query("SELECT slug FROM parks WHERE id = $1", [parkId]);
      const pSlug = parkRes.rows[0]?.slug || parkId;
      generatedSlug = `${generatedSlug}-${pSlug}`;
    }

    const query = `
  UPDATE rollercoasters
  SET name = $1,
      year = $2,
      manufacturer_id = $3,
      ride_model_id = $4,
      model = $5,
      scale = $6,
      haveridden = $7,
      isbestcoaster = $8,
      rating = $9,
      ridecount = $10, 
      slug = $11
  WHERE id = $12 AND park_id = $13
  RETURNING *;
`;

    const result = await pool.query(query, [
      name,
      year,
      manufacturerId,
      rideModelId || null, // NEW
      model,
      scale,
      haveridden,
      isbestcoaster,
      ratingInitial,
      rideCountInitial,
      generatedSlug,
      coasterId,
      parkId
    ]);

    console.log("Database Update Result:", result);
    console.log("Row Count:", result.rowCount);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Coaster not found" }, { status: 404 });
    }

    if (oldRow) {
      // Diff against the row the UPDATE actually produced.
      const updated = result.rows[0];
      const diff = diffFields(oldRow, {
        name: updated.name,
        year: updated.year,
        manufacturer_id: updated.manufacturer_id,
        ride_model_id: updated.ride_model_id, // NEW
        model: updated.model,
        scale: updated.scale,
        haveridden: updated.haveridden,
        isbestcoaster: updated.isbestcoaster,
        rating: updated.rating,
        ridecount: updated.ridecount,
      });
      if (Object.keys(diff).length > 0) {
        logChange({
          parkId: Number(parkId),
          entityType: "coaster",
          entityId: Number(coasterId),
          label: oldRow.name,
          action: "update",
          summary: `Updated coaster ${oldRow.name}: ${describeDiff(diff)}`,
          details: diff,
        });
      }
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json(
      { error: "Failed to update roller coaster" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; coasterId: string }> }
) {
  revalidateContent();
  const { id: parkId, coasterId } = await context.params;
  console.log("Deleting coaster ID:", coasterId, "from park ID:", parkId);

  const result = await pool.query(
    `
    DELETE FROM rollercoasters
    WHERE id = $1 AND park_id = $2
    RETURNING *;
    `,
    [coasterId, parkId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: `Coaster ${coasterId} not found or already deleted` },
      { status: 404 }
    );
  }

  const deleted = result.rows[0];
  logChange({
    parkId: Number(parkId),
    entityType: "coaster",
    entityId: deleted.id,
    label: deleted.name,
    action: "delete",
    summary: `Deleted coaster ${deleted.name}`,
    details: { name: deleted.name, year: deleted.year, manufacturerId: deleted.manufacturer_id },
  });

  return NextResponse.json(
    {
      message: `Coaster ${coasterId} deleted successfully`,
      coaster: result.rows[0],
    },
    { status: 200 }
  );
}