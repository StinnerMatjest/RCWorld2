import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET() {
  try {
    const sql = `
SELECT 
        m.id, m.name, m.country, m.established, m.history, m.in_business, m.notes,
        
        -- Get all properly linked models and their rides
        COALESCE(
          (
SELECT json_agg(
              json_build_object(
                'id', rm.id,
                'name', rm.name,
                'ride_type_id', rm.ride_type_id,
                'rideTypeName', rt.name,
                'year', rm.year,
                'inProduction', rm.in_production,
                'history', rm.history,
                'rides', COALESCE(
                  (
                    SELECT json_agg(
                      json_build_object(
                        'id', r.id,
                        'name', r.name,
                        'year', r.year,
                        'rating', r.rating,
                        'slug', r.slug,
                        'isDefunct', COALESCE(r.is_defunct, false),
                        'country', p.country
                      ) ORDER BY r.year DESC
                    ) FROM rollercoasters r 
                    LEFT JOIN parks p ON p.id = r.park_id
                    WHERE r.ride_model_id = rm.id
                  ), '[]'::json
                )
              ) ORDER BY rm.year DESC
            ) FROM ride_models rm
            LEFT JOIN ride_types rt ON rt.id = rm.ride_type_id
            WHERE rm.manufacturer_id = m.id
          ), '[]'::json
        ) AS models,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', r.id,
                'name', r.name,
                'year', r.year,
                'rating', r.rating,
                'slug', r.slug,
                'isDefunct', COALESCE(r.is_defunct, false),
                'country', p.country -- NEW: Added country from parks table
              ) ORDER BY r.year DESC
            ) FROM rollercoasters r 
            LEFT JOIN parks p ON p.id = r.park_id -- NEW: Join parks table
            WHERE r.manufacturer_id = m.id AND r.ride_model_id IS NULL
          ), '[]'::json
        ) AS unassigned_rides

      FROM manufacturers m
      ORDER BY m.name ASC;
    `;

    const result = await pool.query(sql);
    const manufacturers = result.rows.map((m: any) => {
      const models = m.models || [];

      if (m.unassigned_rides && m.unassigned_rides.length > 0) {
        models.push({
          id: 999999,
          name: "Uncategorized Rides",
          rideTypeName: "Legacy Data",
          year: null,
          inProduction: false,
          history: "These rides have not been linked to a specific Ride Model in the database yet.",
          rides: m.unassigned_rides
        });
      }

      return {
        id: m.id,
        name: m.name,
        country: m.country,
        established: m.established,
        inBusiness: m.in_business,
        history: m.history,
        notes: m.notes,
        models: models
      };
    });

    return NextResponse.json({ manufacturers });
  } catch (error) {
    console.error("Manufacturers API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, country, established, in_business, history, notes } = body;

    // Format the 4-digit year into a Postgres date
    const formattedEstablished = established ? `${established}-01-01` : null;

    const sql = `
            INSERT INTO manufacturers (name, country, established, in_business, history, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
    const result = await pool.query(sql, [name, country, formattedEstablished, in_business ?? true, history, notes]);

    return NextResponse.json({ manufacturer: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Manufacturers POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, country, established, in_business, history, notes } = body;

    // Format the 4-digit year into a Postgres date
    const formattedEstablished = established ? `${established}-01-01` : null;

    const sql = `
            UPDATE manufacturers 
            SET name = $1, country = $2, established = $3, in_business = $4, history = $5, notes = $6
            WHERE id = $7
            RETURNING *;
        `;
    const result = await pool.query(sql, [name, country, formattedEstablished, in_business ?? true, history, notes, id]);

    return NextResponse.json({ manufacturer: result.rows[0] }, { status: 200 });
  } catch (error) {
    console.error("Manufacturers PUT Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    const sql = `DELETE FROM manufacturers WHERE id = $1 RETURNING *;`;
    const result = await pool.query(sql, [id]);

    return NextResponse.json({ success: true, deleted: result.rows[0] }, { status: 200 });
  } catch (error) {
    console.error("Manufacturers DELETE Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}