import { Pool } from "pg";
import { NextResponse } from "next/server";
import { Park } from "@/app/page";

// Creates new pool instance for PostgreSQL connection
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
        parks.id,
        parks.name,
        parks.continent,
        parks.country,
        parks.city,
        parks.imagepath
      FROM parks
    `;
    const result = await pool.query(query);
    console.log("Database result:", result.rows);

    const parks: Park[] = result.rows.map((row) => {
      const normalizedImagePath = row.imagepath
        .replace(/\.png$/, ".PNG")
        .replace(/'$/, "");

      console.log("Converted Image Path: ", normalizedImagePath);

      return {
        id: row.id,
        name: row.name,
        continent: row.continent,
        country: row.country,
        city: row.city,
        imagePath: normalizedImagePath,
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
    const { name, continent, country, city, imagepath } = body;

    if (!name || !continent || !country || !city || !imagepath) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Incoming park data:", body);

    const checkQuery = "SELECT id FROM parks WHERE name = $1";
    const checkResult = await pool.query(checkQuery, [name]);

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
        imagepath
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [name, continent, country, city, imagepath];
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
