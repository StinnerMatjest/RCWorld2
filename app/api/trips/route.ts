import { Pool } from "pg";
import { NextResponse } from "next/server";

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
        id,
        country,
        parks,
        rcdb,
        start_date AS "startDate",
        end_date AS "endDate",
        status,
        notes,
        map_link AS "mapLink",
        trip_log AS "tripLog"
      FROM trips
      ORDER BY 
        CASE WHEN start_date = 'undecided' THEN 1 ELSE 0 END, 
        start_date ASC;
    `;

    const result = await pool.query(query);

    return NextResponse.json({ trips: result.rows }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch trips" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const {
      country,
      parks,
      rcdb = [],
      startDate,
      endDate,
      status,
      notes = null,
      mapLink = null,
      tripLog = []
    } = body;

    if (!country || !parks || !startDate || !endDate || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const countryArray = Array.isArray(country) ? country : [country];

    const query = `
      INSERT INTO trips (
        country, parks, rcdb, start_date, end_date, status, notes, map_link, trip_log
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const values = [
      countryArray,
      parks,
      rcdb,
      startDate,
      endDate,
      status,
      notes,
      mapLink,
      JSON.stringify(tripLog)
    ];

    const result = await pool.query(query, values);

    return NextResponse.json(
      { message: "Trip created successfully", tripId: result.rows[0].id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inserting trip:", error);
    return NextResponse.json({ error: "Failed to create trip" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    const {
      id,
      country,
      parks,
      rcdb = [],
      startDate,
      endDate,
      status,
      notes = null,
      mapLink = null,
      tripLog = []
    } = body;

    if (!id || !country || !parks || !startDate || !endDate || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const countryArray = Array.isArray(country) ? country : [country];

    const query = `
      UPDATE trips SET 
        country = $1, 
        parks = $2, 
        rcdb = $3, 
        start_date = $4, 
        end_date = $5, 
        status = $6, 
        notes = $7, 
        map_link = $8, 
        trip_log = $9
      WHERE id = $10
      RETURNING id
    `;

    const values = [
      countryArray,
      parks,
      rcdb,
      startDate,
      endDate,
      status,
      notes,
      mapLink,
      JSON.stringify(tripLog),
      id
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Trip updated successfully", tripId: result.rows[0].id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating trip:", error);
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Trip ID is required for deletion" }, { status: 400 });
    }

    const query = "DELETE FROM trips WHERE id = $1 RETURNING id";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Trip deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting trip:", error);
    return NextResponse.json({ error: "Failed to delete trip" }, { status: 500 });
  }
}