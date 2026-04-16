// app/api/checklists/[slug]/route.ts
import { Pool } from "pg";
import { NextResponse } from "next/server";
import { Checklist } from "@/app/types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const query = `
      SELECT 
        id, title, slug, description, items, visit_start, visit_end, duration, is_finished, park_id
      FROM checklists 
      WHERE slug = $1
    `;

    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Checklist not found" },
        { status: 404 }
      );
    }

    const checklist: Checklist = result.rows[0];
    return NextResponse.json({ checklist }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch checklist" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { items, visit_start, visit_end, duration, is_finished } = body;

    const query = `
      UPDATE checklists 
      SET 
        items = $1::jsonb,
        visit_start = $2,
        visit_end = $3,
        duration = $4,
        is_finished = $5
      WHERE slug = $6
      RETURNING *
    `;

    const values = [
      JSON.stringify(items),
      visit_start,
      visit_end,
      duration || 0,
      is_finished || false,
      slug
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json({ checklist: result.rows[0] }, { status: 200 });
  } catch (error) {
    console.error("Failed to patch checklist:", error);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const query = "DELETE FROM checklists WHERE slug = $1 RETURNING id";
    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete checklist:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}