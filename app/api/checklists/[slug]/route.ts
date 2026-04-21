import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const query = `
      SELECT 
        id, title, slug, description, items, visit_start, visit_end, duration, is_finished, park_id
      FROM checklists 
      WHERE slug = $1
    `;
    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json({ checklist: result.rows[0] });
  } catch (error) {
    console.error("Error fetching checklist:", error);
    return NextResponse.json({ error: "Failed to fetch checklist" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const body = await request.json();

    // Destructure all the new timing properties sent from ChecklistClient
    const { items, visit_start, visit_end, duration, is_finished } = body;

    // Update the database to actually save the new columns
    const query = `
      UPDATE checklists 
      SET 
        items = $1::jsonb,
        visit_start = $2,
        visit_end = $3,
        duration = $4,
        is_finished = $5
      WHERE slug = $6
      RETURNING *;
    `;

    const values = [
      JSON.stringify(items),
      visit_start || null,
      visit_end || null,
      duration || 0,
      is_finished || false,
      slug
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, checklist: result.rows[0] });
  } catch (error) {
    console.error("Error updating checklist:", error);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const query = "DELETE FROM checklists WHERE slug = $1 RETURNING id";
    const result = await pool.query(query, [slug]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting checklist:", error);
    return NextResponse.json({ error: "Failed to delete checklist" }, { status: 500 });
  }
}