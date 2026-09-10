import { pool } from "@/app/lib/db";
import { NextResponse } from "next/server";


export async function GET() {
  try {
    const query = `
      SELECT 
        rc.id,
        rc.name,
        rc.year,
        rc.manufacturer_id,
        m.name AS manufacturer_name,
        rc.ride_model_id, 
        rc.model,
        rc.scale,
        rc.haveridden,
        rc.isbestcoaster,
        rc.ridecount,
        rc.rating,
        rc.park_id,
        rc.slug,
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
        img.path AS image,
        p.name AS park_name,
        p.country AS park_country,
        p.slug AS park_slug,
        MAX(r.date) AS last_visit_date,
        COUNT(DISTINCT r.id) AS visit_count
      FROM rollercoasters rc
      JOIN parks p ON rc.park_id = p.id
      LEFT JOIN manufacturers m ON rc.manufacturer_id = m.id
      LEFT JOIN rollercoasterspecs rs ON rs.coaster_id = rc.id
      -- Best gallery photo for the coaster, matched by title the way the coaster
      -- page picks its header: explicit HEADER shots first, then full-name matches,
      -- then the short name before " - ", ":" or "(" (gallery titles often use it).
      LEFT JOIN LATERAL (
        SELECT pg.path
        FROM parkgallery pg
        WHERE pg.park_id = rc.park_id
          AND pg.path <> ''
          AND (
            pg.title ILIKE '%' || rc.name || '%'
            OR (
              length(trim(split_part(split_part(split_part(rc.name, ' - ', 1), ':', 1), '(', 1))) >= 4
              AND pg.title ILIKE '%' || trim(split_part(split_part(split_part(rc.name, ' - ', 1), ':', 1), '(', 1)) || '%'
            )
          )
        ORDER BY (pg.title ILIKE '%HEADER%') DESC, (pg.title ILIKE '%' || rc.name || '%') DESC, pg.id ASC
        LIMIT 1
      ) img ON TRUE
      LEFT JOIN ratings r ON r.park_id = p.id
      GROUP BY 
        rc.id, rc.name, rc.year, rc.manufacturer_id, m.name, rc.ride_model_id, rc.model, rc.scale, rc.haveridden, 
        rc.isbestcoaster, rc.ridecount, rc.rating, rc.park_id, rc.slug,
        rs.type, rs.classification, rs.length, rs.height, rs.drop, rs.speed,
        rs.inversions, rs.vertical_angle, rs.gforce, rs.duration_sec, rs.notes, img.path, p.name, p.slug, p.country
      ORDER BY p.name, rc.name;
    `;

    const result = await pool.query(query);

    const coasters = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      year: row.year,
      manufacturerId: row.manufacturer_id,
      manufacturerName: row.manufacturer_name,
      rideModelId: row.ride_model_id,
      model: row.model,
      scale: row.scale,
      haveRidden: row.haveridden,
      isBestCoaster: row.isbestcoaster,
      rideCount: Number(row.ridecount) || 0,
      rating: row.rating,
      parkId: row.park_id,
      slug: row.slug,
      parkSlug: row.park_slug,
      parkName: row.park_name,
      country: row.park_country ?? "Unknown",
      image: row.image ?? null,
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