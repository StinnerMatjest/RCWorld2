import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { revalidateContent } from "@/app/lib/revalidate";

export async function GET() {
    try {
        const query = `
      SELECT 
        m.id,
        m.name,
        m.country,
        m.established,
        m.in_business AS "inBusiness",
        m.history,
        m.notes,
COALESCE(
          json_agg(
            json_build_object(
              'id', r.id,
              'name', r.name,
              'model', r.model,
              'year', r.year,
              'slug', r.slug,
              'rating', r.rating
            )
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS rollercoasters
      FROM manufacturers m
      LEFT JOIN rollercoasters r ON m.id = r.manufacturer_id
      GROUP BY m.id
      ORDER BY m.name ASC;
    `;

        const result = await pool.query(query);

        return NextResponse.json({ manufacturers: result.rows }, { status: 200 });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json({ error: "Failed to fetch manufacturers" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    revalidateContent();
    try {
        const body = await req.json();
        const { name, country, established, inBusiness, history, notes } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Manufacturer name is required" },
                { status: 400 }
            );
        }

        const query = `
      INSERT INTO manufacturers (name, country, established, in_business, history, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

        const values = [
            name,
            country || null,
            established || null,
            inBusiness ?? true,
            history || null,
            notes || null,
        ];

        const result = await pool.query(query, values);

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error("Database insert error:", error);
        return NextResponse.json(
            { error: "Failed to create manufacturer" },
            { status: 500 }
        );
    }
}