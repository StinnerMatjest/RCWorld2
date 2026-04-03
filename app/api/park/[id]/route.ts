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
    const { id } = await context.params;
    const isNumeric = /^\d+$/.test(id);

    const result = isNumeric
      ? await pool.query(
          `
          SELECT
            id,
            name,
            continent,
            country,
            city,
            imagepath,
            slug
          FROM parks
          WHERE id = $1
          `,
          [Number(id)]
        )
      : await pool.query(
          `
          SELECT
            id,
            name,
            continent,
            country,
            city,
            imagepath,
            slug
          FROM parks
          WHERE slug = $1
          `,
          [id]
        );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch park" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { imagepath } = await req.json();
    const isNumeric = /^\d+$/.test(id);

    if (!imagepath) {
      return NextResponse.json(
        { error: "Image path is required" },
        { status: 400 }
      );
    }

    const result = isNumeric
      ? await pool.query(
          `
          UPDATE parks
          SET imagepath = $1
          WHERE id = $2
          RETURNING *;
          `,
          [imagepath, Number(id)]
        )
      : await pool.query(
          `
          UPDATE parks
          SET imagepath = $1
          WHERE slug = $2
          RETURNING *;
          `,
          [imagepath, id]
        );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json(
      { error: "Failed to update park image" },
      { status: 500 }
    );
  }
}