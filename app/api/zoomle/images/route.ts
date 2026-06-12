import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";


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
          COALESCE(zi.focuses, '[]'::jsonb)           AS focuses,
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

    // Image-level update (upsert by coaster_id + image_path)
    const { coaster_id, image_path, focus, enabled } = body;

    // Replace the image's focal list. An image with no focals is out of the pool.
    // Clears flags for the image since flag indices refer to the old focal layout.
    if (body.set_focuses !== undefined) {
      const list: string[] = Array.isArray(body.set_focuses) ? body.set_focuses : [];
      const val = list.length > 0 ? JSON.stringify(list) : null;
      // Update first; if no row exists yet, insert — avoids relying on a unique constraint
      const upd = await pool.query(
        "UPDATE zoomle_images SET focuses = $3::jsonb WHERE coaster_id = $1 AND image_path = $2",
        [coaster_id, image_path, val]
      );
      if ((upd.rowCount ?? 0) === 0 && val) {
        await pool.query(
          "INSERT INTO zoomle_images (coaster_id, image_path, focuses) VALUES ($1, $2, $3::jsonb)",
          [coaster_id, image_path, val]
        );
      }
      await pool.query("DELETE FROM zoomle_flags WHERE image_path = $1", [image_path]);
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
