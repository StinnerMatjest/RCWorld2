import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

type GalleryRow = { id: number; title: string; path: string; description: string };

export async function GET(
  req: NextRequest,
) {
  const url = new URL(req.url);
  const coasterName = url.searchParams.get("name") || "";
  const parkId = url.searchParams.get("parkId");

  if (!parkId) {
    return NextResponse.json({ error: "Missing parkId" }, { status: 400 });
  }

  // Gallery titles are typed by hand and often use a shorter form of the
  // coaster's name ("Colossos: Kampf der Giganten" in the gallery, "Colossos -
  // Kampf der Giganten" in the coaster table). Try the full name first, then
  // the part before " - ", ":" or "(".
  const shortName = coasterName.split(/\s+-\s+|:|\(/)[0].trim();
  const nameForms =
    shortName && shortName.length >= 4 && shortName !== coasterName
      ? [coasterName, shortName]
      : [coasterName];

  try {
    let activeHeader: GalleryRow | null = null;
    let allActiveHeaders: GalleryRow[] = [];
    let gallery: GalleryRow[] = [];

    for (const name of nameForms) {
      // Explicit headers first
      const headerRes = await pool.query(
        `
        SELECT id, title, path, description
        FROM parkgallery
        WHERE park_id = $1 AND title ILIKE $2
        ORDER BY id DESC
        `,
        [parkId, `%${name}%HEADER%`]
      );
      allActiveHeaders = headerRes.rows;
      activeHeader = headerRes.rows[0] || null;

      // Fallback to any coaster image if no explicit header exists
      if (!activeHeader) {
        const fallbackRes = await pool.query(
          `
          SELECT id, title, path, description
          FROM parkgallery
          WHERE park_id = $1 AND title ILIKE $2
          ORDER BY id ASC
          LIMIT 1
          `,
          [parkId, `%${name}%`]
        );
        activeHeader = fallbackRes.rows[0] || null;
      }

      // The rest of the gallery (excluding HEADER ONLY)
      const galleryRes = await pool.query(
        `
        SELECT id, title, path, description
        FROM parkgallery
        WHERE park_id = $1
          AND title ILIKE $2
          AND title NOT ILIKE $3
        ORDER BY id ASC
        `,
        [parkId, `%${name}%`, `%HEADER ONLY%`]
      );
      gallery = galleryRes.rows;

      if (activeHeader || gallery.length > 0) break;
    }

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
