import { Pool } from "pg";
import { NextResponse } from "next/server";
import { Park } from "@/app/types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Enable this if Railway requires SSL
  },
});

export async function GET() {
  try {
    const query = `
      SELECT
        id,
        name,
        continent,
        country,
        city,
        imagepath,
        slug,
        image_focus AS "imageFocus",
        header_focus AS "headerFocus",
        card_images AS "cardImages"
      FROM parks
    `;
    const result = await pool.query(query);
    console.log("Database result:", result.rows);

    const parks: Park[] = result.rows.map((row) => {
      return {
        id: row.id,
        name: row.name,
        continent: row.continent,
        country: row.country,
        city: row.city,
        imagepath: row.imagepath,
        slug: row.slug,
        imageFocus: row.imageFocus ?? undefined,
        headerFocus: row.headerFocus ?? undefined,
        cardImages:  row.cardImages  ?? undefined,
      };
    });

    return NextResponse.json({ parks }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);

    return NextResponse.json(
      { error: "Failed to fetch parks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, continent, country, city, imagepath, slug } = body;

    // Autogenerate a URL-friendly slug if one isn't explicitly provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    if (!name || !continent || !country || !city || !imagepath || !finalSlug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Incoming park data:", body);

    const checkQuery = "SELECT id FROM parks WHERE name = $1 OR slug = $2";
    const checkResult = await pool.query(checkQuery, [name, finalSlug]);

    if (checkResult.rows.length > 0) {
      const existingParkId = checkResult.rows[0].id;
      return NextResponse.json(
        { message: `${name} already exists`, parkId: existingParkId },
        { status: 200 }
      );
    }
    const query = `
      INSERT INTO parks (
        name,
        continent,
        country,
        city,
        imagepath,
        slug
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const values = [name, continent, country, city, imagepath, finalSlug];
    const result = await pool.query(query, values);
    const newParkId = result.rows[0].id;

    return NextResponse.json(
      { message: `${name} created successfully`, parkId: newParkId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inserting park:", error);

    return NextResponse.json(
      { error: `Failed to create park: ${error || "Unknown error"}` },
      { status: 500 }
    );
  }
}