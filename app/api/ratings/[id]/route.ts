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

    if (typeof body.published !== "boolean") {
      return NextResponse.json(
        { error: "Invalid published status" },
        { status: 400 }
      );
    }

    const query = `
      UPDATE ratings 
      SET published = $1 
      WHERE id = $2 
      RETURNING id
    `;

    const result = await pool.query(query, [body.published, ratingId]);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Rating not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Rating published successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update rating:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}