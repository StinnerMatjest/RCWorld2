import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id: coasterSlug } = await context.params;

    if (!coasterSlug || coasterSlug === "undefined" || coasterSlug === "null") {
        return NextResponse.json({ error: "Invalid coaster slug" }, { status: 400 });
    }

    try {
        const coasterQuery = `
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
                rc.slug,
                p.slug AS park_slug,
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
            JOIN parks p ON rc.park_id = p.id
            LEFT JOIN rollercoasterspecs rs ON rs.coaster_id = rc.id
            WHERE rc.slug = $1
        `;

        const coasterResult = await pool.query(coasterQuery, [coasterSlug]);
        const row = coasterResult.rows[0];

        if (!row) {
            return NextResponse.json({ coaster: null }, { status: 404 });
        }

        const numericCoasterId = row.id;
        const highlightsQuery = `
            SELECT 
                category,
                severity
            FROM rollercoasterhighlights
            WHERE coaster_id = $1
            ORDER BY severity, id
        `;

        const highlightsResult = await pool.query(highlightsQuery, [numericCoasterId]);
        const highlights = highlightsResult.rows;

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
            slug: row.slug,
            parkSlug: row.park_slug,
            highlights: highlights.map(h => ({
                category: h.category,
                severity: h.severity,
            })),
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