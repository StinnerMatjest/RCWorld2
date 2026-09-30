import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { revalidateContent } from "@/app/lib/revalidate";

type GalleryRow = {
  id: number; title: string; path: string; description: string; is_header: boolean;
  focus_mobile: string | null; focus_desktop: string | null; featured: boolean;
};

// The header photo is cropped separately for the phone hero (portrait) and the
// desktop hero (wide). Both crops live on the gallery row that is the header,
// as "cx cy zoom" strings (see FocusedImage). Added in place; runs once per process.
let focusColumns: Promise<void> | null = null;
function ensureFocusColumns(): Promise<void> {
  if (!focusColumns) {
    focusColumns = pool
      .query(`ALTER TABLE coastergallery
              ADD COLUMN IF NOT EXISTS focus_mobile TEXT,
              ADD COLUMN IF NOT EXISTS focus_desktop TEXT,
              ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false`)
      .then(() => undefined)
      .catch((err) => { focusColumns = null; throw err; });
  }
  return focusColumns;
}

const COLS = "id, title, path, description, is_header, focus_mobile, focus_desktop, featured";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const coasterId = Number(id);

    if (!coasterId || isNaN(coasterId)) {
      return NextResponse.json({ error: "Invalid or missing coaster ID" }, { status: 400 });
    }
    await ensureFocusColumns();

    // Fetch explicit headers based on the new boolean column
    const headerRes = await pool.query<GalleryRow>(
      `SELECT ${COLS} FROM coastergallery WHERE coaster_id = $1 AND is_header = true ORDER BY id DESC`,
      [coasterId]
    );
    const allActiveHeaders = headerRes.rows;
    let activeHeader: GalleryRow | null = headerRes.rows[0] || null;

    // Fallback to any coaster image if no explicit header is flagged
    if (!activeHeader) {
      const fallbackRes = await pool.query<GalleryRow>(
        `SELECT ${COLS} FROM coastergallery WHERE coaster_id = $1 ORDER BY id ASC LIMIT 1`,
        [coasterId]
      );
      activeHeader = fallbackRes.rows[0] || null;
    }

    // Fetch the rest of the gallery images for this coaster
    const galleryRes = await pool.query<GalleryRow>(
      `SELECT ${COLS} FROM coastergallery WHERE coaster_id = $1 ORDER BY id ASC`,
      [coasterId]
    );
    const gallery = galleryRes.rows;

    const headerImage = activeHeader?.path || null;
    const headerFocus = {
      mobile: activeHeader?.focus_mobile ?? null,
      desktop: activeHeader?.focus_desktop ?? null,
    };

    return NextResponse.json({ headerImage, headerFocus, activeHeader, allActiveHeaders, gallery });
  } catch (error) {
    console.error("Failed to fetch coaster gallery images", error);
    return NextResponse.json(
      { error: "Failed to fetch coaster gallery images" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  try {
    const { id } = await context.params;
    const coasterId = parseInt(id, 10);
    const { path, title, description, isHeader } = await req.json();

    // If this new image is set as the header, un-header the others for this coaster
    if (isHeader) {
      await pool.query(`UPDATE coastergallery SET is_header = false WHERE coaster_id = $1`, [coasterId]);
    }

    const res = await pool.query(
      `INSERT INTO coastergallery (coaster_id, path, title, description, is_header)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [coasterId, path, title || "", description || "", isHeader || false]
    );

    return NextResponse.json({ success: true, image: res.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Failed to save coaster image:", error);
    return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  try {
    const { id } = await context.params; // coasterId
    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) return NextResponse.json({ error: "Missing image ID" }, { status: 400 });

    await pool.query("DELETE FROM coastergallery WHERE id = $1 AND coaster_id = $2", [imageId, id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete coaster image:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

const FOCUS_RE = /^\d?\.?\d+(\.\d+)? \d?\.?\d+(\.\d+)? \d+(\.\d+)?$/;
const cleanFocus = (v: unknown): string | null =>
  typeof v === "string" && FOCUS_RE.test(v.trim()) ? v.trim() : null;

/**
 * Make an image the header and/or set its phone and desktop crops.
 * Body: { imageId, focusMobile?, focusDesktop? }. Omitted crops are kept.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  const client = await pool.connect();
  try {
    const { id } = await context.params;
    const coasterId = parseInt(id, 10);
    const body = await req.json();
    await ensureFocusColumns();

    // { featuredIds: number[] } sets exactly which photos show in the strip at
    // the top of the page (an empty list means visitors see all of them).
    if (Array.isArray(body.featuredIds)) {
      const ids = body.featuredIds.map(Number).filter((n: number) => Number.isFinite(n));
      await client.query(
        `UPDATE coastergallery SET featured = (id = ANY($2::int[])) WHERE coaster_id = $1`,
        [coasterId, ids]
      );
      return NextResponse.json({ success: true, featuredIds: ids }, { status: 200 });
    }

    const imageId = Number(body.imageId);
    if (!imageId) return NextResponse.json({ error: "Missing imageId" }, { status: 400 });

    // { imageId, featured } only toggles whether the photo shows in the strip
    // at the top of the page; the header is left alone.
    if (typeof body.featured === "boolean" && body.focusMobile === undefined && body.focusDesktop === undefined) {
      const res = await client.query(
        `UPDATE coastergallery SET featured = $3 WHERE id = $1 AND coaster_id = $2 RETURNING ${COLS}`,
        [imageId, coasterId, body.featured]
      );
      return NextResponse.json({ success: true, image: res.rows[0] ?? null }, { status: 200 });
    }

    await client.query("BEGIN");

    // Remove the header flag from all images belonging to this coaster
    await client.query(`UPDATE coastergallery SET is_header = false WHERE coaster_id = $1`, [coasterId]);

    // Add the header flag exclusively to the selected image, with its crops
    const res = await client.query(
      `UPDATE coastergallery
         SET is_header = true,
             focus_mobile = COALESCE($3, focus_mobile),
             focus_desktop = COALESCE($4, focus_desktop)
       WHERE id = $1 AND coaster_id = $2
       RETURNING ${COLS}`,
      [imageId, coasterId, cleanFocus(body.focusMobile), cleanFocus(body.focusDesktop)]
    );

    await client.query("COMMIT");

    return NextResponse.json({ success: true, image: res.rows[0] ?? null }, { status: 200 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to patch coaster header:", error);
    return NextResponse.json({ error: "Failed to set header" }, { status: 500 });
  } finally {
    client.release();
  }
}
