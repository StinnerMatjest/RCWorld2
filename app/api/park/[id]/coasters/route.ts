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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parkId } = await context.params; // Resolve params in Next.js 15

    console.log("Fetching coasters for park ID:", parkId);

    const query = `
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
  WHERE park_id = $1
`;

    const result = await pool.query(query, [parkId]);

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch roller coasters" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parkId } = await context.params;
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

    const rideCountInitial = Number.isNaN(Number(rideCount))
      ? 0
      : Number(rideCount);

    const query = `
      INSERT INTO rollercoasters
        (park_id, name, year, manufacturer, model, scale, haveridden, isbestcoaster, rcdbpath, rating, ridecount)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      parkId,
      name,
      year,
      manufacturer,
      model,
      scale,
      haveridden,
      isbestcoaster,
      rcdbpath,
      rating,
      rideCountInitial,
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Database insert error:", error);
    return NextResponse.json(
      { error: "Failed to create roller coaster" },
      { status: 500 }
    );
  }
}
