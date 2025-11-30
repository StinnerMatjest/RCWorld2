import { Pool } from "pg";
import { NextResponse } from "next/server";

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
        rc.id,
        rc.name,
        rc.year,
        rc.manufacturer,
        rc.model,
        rc.scale,
        rc.haveridden,
        rc.isbestcoaster,
        rc.rcdbpath,
        rc.ridecount,
        rc.rating,
        rc.park_id,
        p.name AS park_name,
        MAX(r.date) AS last_visit_date,

        -- Specs
        specs.type,
        specs.classification,
        specs.length_ft,
        specs.height_ft,
        specs.drop_ft,
        specs.speed_mph,
        specs.inversions,
        specs.vertical_angle_deg,
        specs.gforce,
        specs.duration_sec,
        specs.notes

      FROM rollercoasters rc
      JOIN parks p ON rc.park_id = p.id
      LEFT JOIN ratings r ON r.park_id = p.id
      LEFT JOIN rollercoasterspecs specs ON specs.coaster_id = rc.id

      GROUP BY 
        rc.id, rc.name, rc.year, rc.manufacturer, rc.model, rc.scale, rc.haveridden, 
        rc.isbestcoaster, rc.rcdbpath, rc.ridecount, rc.rating, rc.park_id, p.name,
        specs.type, specs.classification, specs.length_ft, specs.height_ft, specs.drop_ft, 
        specs.speed_mph, specs.inversions, specs.vertical_angle_deg, specs.gforce,
        specs.duration_sec, specs.notes

      ORDER BY p.name, rc.name;
    `;

    const result = await pool.query(query);

    // Base coasterinfo
    const coasters = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      year: row.year,
      manufacturer: row.manufacturer,
      model: row.model,
      scale: row.scale,
      haveRidden: row.haveridden,
      isBestCoaster: row.isbestcoaster,
      rcdbPath: row.rcdbpath,
      rideCount: row.ridecount,
      rating: row.rating,
      parkId: row.park_id,
      parkName: row.park_name,
      lastVisitDate: row.last_visit_date,

      // Coasterspecs
      specs: {
        type: row.type,
        classification: row.classification,
        length: row.length_ft,
        height: row.height_ft,
        drop: row.drop_ft,
        speed: row.speed_mph,
        inversions: row.inversions,
        verticalAngle: row.vertical_angle_deg,
        gforce: row.gforce,
        duration: row.duration_sec,
        notes: row.notes,
      },
    }));

    return NextResponse.json({ coasters }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch coasters" }, { status: 500 });
  }
}
