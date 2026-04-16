import { Pool } from "pg";
import { NextResponse } from "next/server";
import { Checklist } from "@/app/types";

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
        title,
        slug,
        description,
        items,
        visit_start,
        visit_end,
        duration,
        is_finished
      FROM checklists
      ORDER BY id DESC
    `;
    const result = await pool.query(query);

    const checklists: Checklist[] = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      items: row.items,
      visit_start: row.visit_start,
      visit_end: row.visit_end,
      duration: row.duration,
      is_finished: row.is_finished,
    }));

    return NextResponse.json({ checklists }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch checklists" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, slug, description, items } = body;

    if (!title || !slug || !items) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO checklists (title, slug, description, items, park_id)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id, slug
    `;

    const values = [title, slug, description, JSON.stringify(items), body.parkId];
    const result = await pool.query(query, values);

    // If result.rows.length is 0, it means the conflict triggered (checklist already exists)
    if (result.rows.length === 0) {
      return NextResponse.json(
        { message: "Checklist already exists", slug: slug },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: "Checklist created", slug: result.rows[0].slug },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating checklist:", error);
    return NextResponse.json(
      { error: "Failed to create checklist" },
      { status: 500 }
    );
  }
}