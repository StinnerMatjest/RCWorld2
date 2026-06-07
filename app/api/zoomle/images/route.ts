import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Every gallery image matching a coaster name is implicitly in the pool (enabled, focus 50% 50%).
// zoomle_images stores OVERRIDES only: custom focal points and/or disabled status.

const BASE_JOIN = `
  FROM rollercoasters rc
  JOIN parks p ON p.id = rc.park_id
  JOIN parkgallery pg
    ON  pg.park_id = rc.park_id
    AND pg.title ILIKE '%' || rc.name || '%'
    AND pg.title NOT ILIKE '%HEADER ONLY%'
  LEFT JOIN zoomle_images zi
    ON  zi.coaster_id = rc.id
    AND zi.image_path = pg.path
`;

export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  try {
    const [imagesRes, missingRes] = await Promise.all([
      pool.query(`
        SELECT
          zi.id                                AS zoomle_id,
          pg.id                                AS gallery_id,
          pg.path                              AS image_path,
          COALESCE(zi.focus, '50% 50%')               AS focus,
          COALESCE(zi.focuses_override, '{}'::jsonb)  AS focuses_override,
          COALESCE(zi.enabled, TRUE)                  AS enabled,
          rc.id                                AS coaster_id,
          rc.name                              AS coaster_name,
          COALESCE(rc.zoomle_enabled, TRUE)    AS coaster_enabled,
          p.name                               AS park_name,
          p.country                            AS park_country,
          p.id                                 AS park_id
        ${BASE_JOIN}
        ${all ? "" : "WHERE COALESCE(zi.enabled, TRUE) = TRUE AND COALESCE(rc.zoomle_enabled, TRUE) = TRUE"}
        ORDER BY p.name, rc.name, (pg.title ILIKE '%HEADER%') DESC, pg.id ASC
      `),
      all ? pool.query(`
        SELECT rc.id, rc.name, rc.slug, p.name AS park_name
        FROM rollercoasters rc
        JOIN parks p ON p.id = rc.park_id
        LEFT JOIN parkgallery pg
          ON  pg.park_id = rc.park_id
          AND pg.title ILIKE '%' || rc.name || '%'
          AND pg.title NOT ILIKE '%HEADER ONLY%'
        WHERE pg.id IS NULL
        ORDER BY p.name, rc.name
      `) : Promise.resolve({ rows: [] }),
    ]);

    return NextResponse.json({ images: imagesRes.rows, missing: missingRes.rows });
  } catch (error) {
    console.error("zoomle/images GET:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// PATCH â€” upsert an override for (coaster_id, image_path) or toggle coaster_enabled
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // Coaster-level toggle
    if (body.coaster_id !== undefined && body.coaster_enabled !== undefined) {
      await pool.query(
        "UPDATE rollercoasters SET zoomle_enabled = $1 WHERE id = $2",
        [body.coaster_enabled, body.coaster_id]
      );
      return NextResponse.json({ ok: true });
    }

    // Image-level override (upsert by coaster_id + image_path)
    const { coaster_id, image_path, focus, enabled, add_to_focuses } = body;

    // Save custom focal override for a specific grid position
    if (body.focal_override !== undefined) {
      const { coaster_id: cid, image_path: ip, focal_override: { focal_index: fi, focus: foc } } = body;
      // Update first; if no row exists yet, insert — avoids relying on a unique constraint
      const upd = await pool.query(`
        UPDATE zoomle_images
        SET focuses_override = COALESCE(focuses_override, '{}') || jsonb_build_object($3::text, $4::text)
        WHERE coaster_id = $1 AND image_path = $2
      `, [cid, ip, String(fi), foc]);
      if ((upd.rowCount ?? 0) === 0) {
        await pool.query(`
          INSERT INTO zoomle_images (coaster_id, image_path, focuses_override)
          VALUES ($1, $2, jsonb_build_object($3::text, $4::text))
        `, [cid, ip, String(fi), foc]);
      }
      return NextResponse.json({ ok: true });
    }

    if (add_to_focuses) {
      // Append a new focal point to the focuses array
      await pool.query(`
        INSERT INTO zoomle_images (coaster_id, image_path, focus, enabled, focuses)
        VALUES ($1, $2, $3, TRUE, $4::jsonb)
        ON CONFLICT (coaster_id, image_path)
        DO UPDATE SET focuses = (
          SELECT jsonb_agg(DISTINCT val)
          FROM jsonb_array_elements_text(
            COALESCE(zoomle_images.focuses, '[]'::jsonb) || to_jsonb($3::text)
          ) val
        )
      `, [coaster_id, image_path, add_to_focuses, JSON.stringify([add_to_focuses])]);
      return NextResponse.json({ ok: true });
    }

    await pool.query(`
      INSERT INTO zoomle_images (coaster_id, image_path, focus, enabled)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (coaster_id, image_path)
      DO UPDATE SET
        focus   = COALESCE(EXCLUDED.focus,   zoomle_images.focus),
        enabled = COALESCE(EXCLUDED.enabled, zoomle_images.enabled)
    `, [coaster_id, image_path, focus ?? null, enabled ?? null]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("zoomle/images PATCH:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE â€” remove override (image goes back to default: enabled, 50% 50%)
export async function DELETE(req: NextRequest) {
  try {
    const { coaster_id, image_path } = await req.json();
    await pool.query(
      "DELETE FROM zoomle_images WHERE coaster_id = $1 AND image_path = $2",
      [coaster_id, image_path]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("zoomle/images DELETE:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
