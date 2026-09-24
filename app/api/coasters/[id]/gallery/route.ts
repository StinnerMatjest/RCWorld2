import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

type GalleryRow = { id: number; title: string; path: string; description: string; is_header: boolean };

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

    // Fetch explicit headers based on the new boolean column
    const headerRes = await pool.query(
      `
      SELECT id, title, path, description, is_header
      FROM coastergallery
      WHERE coaster_id = $1 AND is_header = true
      ORDER BY id DESC
      `,
      [coasterId]
    );
    const allActiveHeaders = headerRes.rows;
    let activeHeader = headerRes.rows[0] || null;

    // Fallback to any coaster image if no explicit header is flagged
    if (!activeHeader) {
      const fallbackRes = await pool.query(
        `
        SELECT id, title, path, description, is_header
        FROM coastergallery
        WHERE coaster_id = $1
        ORDER BY id ASC
        LIMIT 1
        `,
        [coasterId]
      );
      activeHeader = fallbackRes.rows[0] || null;
    }

    // Fetch the rest of the gallery images for this coaster
    const galleryRes = await pool.query(
      `
      SELECT id, title, path, description, is_header
      FROM coastergallery
      WHERE coaster_id = $1
      ORDER BY id ASC
      `,
      [coasterId]
    );
    const gallery = galleryRes.rows;

    const headerImage = activeHeader?.path || null;

    return NextResponse.json({ headerImage, activeHeader, allActiveHeaders, gallery });
  } catch (error) {
    console.error("Failed to fetch coaster gallery images", error);
    return NextResponse.json(
      { error: "Failed to fetch coaster gallery images" },
      { status: 500 }
    );
  }
}