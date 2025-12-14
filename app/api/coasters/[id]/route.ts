import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const coasterId = Number(params.id);
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
        rs.notes
      FROM rollercoasters rc
      LEFT JOIN rollercoasterspecs rs ON rs.coaster_id = rc.id
      WHERE rc.id = $1
    `;

        const result = await pool.query(query, [coasterId]);
        const row = result.rows[0];

        if (!row) return NextResponse.json({ coaster: null }, { status: 404 });

        const coaster = {
            id: row.id,
            name: row.name,
            year: row.year,
            manufacturer: row.manufacturer,
            model: row.model,
            scale: row.scale,
            haveridden: row.haveridden,
            isbestcoaster: row.isbestcoaster,
            rcdbpath: row.rcdbpath,
            ridecount: row.ridecount,
            rating: row.rating,
            parkId: row.park_id,
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
            }
        };

        return NextResponse.json({ coaster });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json({ error: "Failed to fetch coaster" }, { status: 500 });
    }
}
