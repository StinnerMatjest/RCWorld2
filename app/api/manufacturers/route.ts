import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET() {
    try {
        const sql = `
      SELECT 
        m.id, m.name, m.country, m.established, m.history,
        
        -- Get all properly linked models and their rides
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', rm.id,
                'name', rm.name,
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

        -- Get all legacy rides that haven't been linked to a model yet
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

        // Merge the unassigned rides into a virtual "Legacy" model 
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
                models: models
            };
        });

        return NextResponse.json({ manufacturers });
    } catch (error) {
        console.error("Manufacturers API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}