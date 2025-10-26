import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; coasterId: string }> }
) {
  const { id: parkId, coasterId } = await context.params;
  console.log("Fetching coaster ID:", coasterId, "from park ID:", parkId);

  const result = await pool.query(
    `
  SELECT
    id,
    name,
    year,
    manufacturer,
    model,
    scale,
    haveridden,
    isbestcoaster,
    rcdbpath,
    rating,
    ridecount
  FROM rollercoasters
  WHERE id = $1 AND park_id = $2;
  `,
    [coasterId, parkId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      {
        error: `Park: ${parkId} does not contain a coaster with ID: ${coasterId}`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json(result.rows[0], { status: 200 });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; coasterId: string }> }
) {
  try {
    const { id: parkId, coasterId } = await context.params;
    const body = await req.json();
    const {
      name,
      year,
      manufacturer,
      model,
      scale,
      haveridden,
      isbestcoaster,
      rcdbpath,
      rating,
      rideCount,
    } = body;

    if (
      !name ||
      !year ||
      !manufacturer ||
      !model ||
      !scale ||
      haveridden === undefined ||
      isbestcoaster === undefined ||
      !rcdbpath ||
      rating === undefined ||
      rideCount === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const ratingInitial = haveridden
      ? Number.isNaN(Number(rating)) ? 0 : Number(rating)
      : 0;

    const rideCountInitial = haveridden
      ? Number.isNaN(Number(rideCount)) ? 0 : Number(rideCount)
      : 0;


    const query = `
UPDATE rollercoasters
SET name = $1,
    year = $2,
    manufacturer = $3,
    model = $4,
    scale = $5,
    haveridden = $6,
    isbestcoaster = $7,
    rcdbpath = $8,
    rating = $9,
    ridecount = CASE WHEN $6 THEN ridecount + $10 ELSE ridecount END
WHERE id = $11 AND park_id = $12
RETURNING *;

`;

    const result = await pool.query(query, [
      name,
      year,
      manufacturer,
      model,
      scale,
      haveridden,
      isbestcoaster,
      rcdbpath,
      ratingInitial,
      rideCountInitial,
      coasterId,
      parkId,
    ]);


    console.log("Database Update Result:", result);
    console.log("Row Count:", result.rowCount);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Coaster not found" }, { status: 404 });
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

  return NextResponse.json(
    {
      message: `Coaster ${coasterId} deleted successfully`,
      coaster: result.rows[0],
    },
    { status: 200 }
  );
}
