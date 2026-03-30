import { Pool } from "pg";
import { NextResponse } from "next/server";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function POST(request: Request) {
  try {
    const { ratingId, ride, note, category, severity } = await request.json();

    if (!ratingId || !ride || !note || !category || !severity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const query = `
      INSERT INTO ratingwarning (ratingid, ride, note, category, severity)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query(query, [ratingId, ride, note, category, severity]);

    return NextResponse.json({ message: "Warning added", warning: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error adding warning:", error);
    return NextResponse.json({ error: "Failed to add warning" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ride, note, category, severity } = await request.json();

    if (!id || !ride || !note || !category || !severity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const query = `
      UPDATE ratingwarning 
      SET ride = $1, note = $2, category = $3, severity = $4
      WHERE id = $5
      RETURNING *;
    `;
    const result = await pool.query(query, [ride, note, category, severity, id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Warning not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Warning updated", warning: result.rows[0] }, { status: 200 });
  } catch (error) {
    console.error("Error updating warning:", error);
    return NextResponse.json({ error: "Failed to update warning" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Warning ID is required" }, { status: 400 });
    }

    const query = "DELETE FROM ratingwarning WHERE id = $1 RETURNING id;";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Warning not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Warning deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting warning:", error);
    return NextResponse.json({ error: "Failed to delete warning" }, { status: 500 });
  }
}