import { slugify } from "@/app/lib/slug";
import { pool } from "@/app/lib/db";
import { getImageSizes } from "@/app/lib/imageDims";
import { validCut } from "@/app/lib/cardCut";
import { revalidateContent } from "@/app/lib/revalidate";
import { logChange } from "@/app/lib/changelog";
import { NextResponse } from "next/server";
import { Park } from "@/app/types";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const query = `
      SELECT
        id,
        name,
        continent,
        country,
        city,
        imagepath,
        card_imagepath AS "cardImagepath",
        slug,
        image_focus AS "imageFocus",
        header_focus AS "headerFocus",
        card_images AS "cardImages",
        card_cut AS "cardCut"
      FROM parks
    `;
    const result = await pool.query(query);

    // Pixel sizes of every photo referenced, so cards can pick the exact file.
    const urls: string[] = [];
    for (const row of result.rows) {
      urls.push(row.imagepath, row.cardImagepath);
      for (const e of Object.values(row.cardImages ?? {}) as { src?: string }[]) if (e?.src) urls.push(e.src);
    }
    const sizes = await getImageSizes(urls);

    const parks: Park[] = result.rows.map((row) => {
      const cardImages = row.cardImages
        ? Object.fromEntries(
            Object.entries(row.cardImages as Record<string, { src: string; focus: string; cut?: any }>).map(([k, e]) => [
              k,
              e?.src ? { ...e, size: sizes[e.src], cut: validCut(e.cut, e.src, e.focus) } : e,
            ])
          )
        : undefined;
      const cardSrc = row.cardImagepath || row.imagepath;
      return {
        id: row.id,
        name: row.name,
        continent: row.continent,
        country: row.country,
        city: row.city,
        imagepath: row.imagepath,
        imageSize: sizes[row.imagepath],
        cardImagepath: row.cardImagepath ?? undefined,
        cardImageSize: row.cardImagepath ? sizes[row.cardImagepath] : undefined,
        slug: row.slug,
        imageFocus: row.imageFocus ?? undefined,
        headerFocus: row.headerFocus ?? undefined,
        cardCut: validCut(row.cardCut, cardSrc, row.imageFocus),
        cardImages,
      };
    });

    return NextResponse.json({ parks }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);

    return NextResponse.json(
      { error: "Failed to fetch parks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  revalidateContent();
  try {
    const body = await request.json();
    const { name, continent, country, city, imagepath, slug } = body;

    // Autogenerate a URL-friendly slug if one isn't explicitly provided
    const finalSlug = slug ? slugify(slug) : slugify(name);

    if (!name || !continent || !country || !city || !imagepath || !finalSlug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Incoming park data:", body);

    const checkQuery = "SELECT id FROM parks WHERE name = $1 OR slug = $2";
    const checkResult = await pool.query(checkQuery, [name, finalSlug]);

    if (checkResult.rows.length > 0) {
      const existingParkId = checkResult.rows[0].id;
      return NextResponse.json(
        { message: `${name} already exists`, parkId: existingParkId },
        { status: 200 }
      );
    }
    const query = `
      INSERT INTO parks (
        name,
        continent,
        country,
        city,
        imagepath,
        slug
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const values = [name, continent, country, city, imagepath, finalSlug];
    const result = await pool.query(query, values);
    const newParkId = result.rows[0].id;

    logChange({
      parkId: newParkId,
      entityType: "park",
      entityId: newParkId,
      label: name,
      action: "create",
      summary: `Created park ${name}`,
      details: { continent, country, city, slug: finalSlug },
    });

    revalidateTag("parks-leaderboard"); // Clear the Parks Leaderboard cache
    return NextResponse.json(
      { message: `${name} created successfully`, parkId: newParkId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inserting park:", error);

    return NextResponse.json(
      { error: `Failed to create park: ${error || "Unknown error"}` },
      { status: 500 }
    );
  }
}