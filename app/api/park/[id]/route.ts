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
        `SELECT id, name, continent, country, city, imagepath, slug FROM parks WHERE id = $1`,
        [Number(id)]
      )
      : await pool.query(
        `SELECT id, name, continent, country, city, imagepath, slug FROM parks WHERE slug = $1`,
        [id]
      );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch park" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const isNumeric = /^\d+$/.test(id);

    // Build dynamic query to update only the fields provided in the body
    const fields = [];
    const values = [];
    let queryIdx = 1;

    if (body.name) { fields.push(`name = $${queryIdx++}`); values.push(body.name); }
    if (body.continent) { fields.push(`continent = $${queryIdx++}`); values.push(body.continent); }
    if (body.country) { fields.push(`country = $${queryIdx++}`); values.push(body.country); }
    if (body.city) { fields.push(`city = $${queryIdx++}`); values.push(body.city); }
    if (body.imagepath) { fields.push(`imagepath = $${queryIdx++}`); values.push(body.imagepath); }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(isNumeric ? Number(id) : id);
    const condition = isNumeric ? `id = $${queryIdx}` : `slug = $${queryIdx}`;

    const query = `
      UPDATE parks
      SET ${fields.join(", ")}
      WHERE ${condition}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json({ error: "Failed to update park" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const isNumeric = /^\d+$/.test(id);

    // *Note: This assumes you have "ON DELETE CASCADE" set up on your foreign keys 
    // (like coasters and checklists) in your database so they delete automatically with the park.
    const query = isNumeric
      ? `DELETE FROM parks WHERE id = $1 RETURNING *;`
      : `DELETE FROM parks WHERE slug = $1 RETURNING *;`;

    const result = await pool.query(query, [isNumeric ? Number(id) : id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Park deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Database delete error:", error);
    return NextResponse.json({ error: "Failed to delete park" }, { status: 500 });
  }
}