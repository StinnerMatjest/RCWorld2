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
        rs.type,
        rs.classification,
        rs.length,
        rs.height,
        rs.drop,
        rs.speed,
        rs.inversions,
        rs.vertical_angle,
        rs.gforce,
        rs.duration_sec AS duration,
        rs.notes,
        p.name AS park_name,
        MAX(r.date) AS last_visit_date,
        COUNT(DISTINCT r.id) AS visit_count
      FROM rollercoasters rc
      JOIN parks p ON rc.park_id = p.id
      LEFT JOIN rollercoasterspecs rs ON rs.coaster_id = rc.id
      LEFT JOIN ratings r ON r.park_id = p.id
      GROUP BY 
        rc.id, rc.name, rc.year, rc.manufacturer, rc.model, rc.scale, rc.haveridden, 
        rc.isbestcoaster, rc.rcdbpath, rc.ridecount, rc.rating, rc.park_id, 
        rs.type, rs.classification, rs.length, rs.height, rs.drop, rs.speed, 
        rs.inversions, rs.vertical_angle, rs.gforce, rs.duration_sec, rs.notes, p.name
      ORDER BY p.name, rc.name;
    `;

    const result = await pool.query(query);

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
      visitCount: Number(row.visit_count) || 0,
      specs: {
        type: row.type,
        classification: row.classification,
        length: row.length,
        height: row.height,
        drop: row.drop,
        speed: row.speed,
        inversions: row.inversions,
        verticalAngle: row.vertical_angle,
        gforce: row.gforce,
        duration: row.duration,
        notes: row.notes,
      },
    }));

    return NextResponse.json({ coasters }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch coasters" }, { status: 500 });
  }
}