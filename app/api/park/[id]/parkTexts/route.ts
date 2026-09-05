import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { diffFields, logChange } from "@/app/lib/changelog";

// parktexts rows hang off a rating; resolve the owning park for the changelog.
async function ratingContext(ratingId: number | string) {
  try {
    const r = await pool.query(
      `SELECT p.id AS park_id, p.name AS park_name
       FROM ratings JOIN parks p ON p.id = ratings.park_id
       WHERE ratings.id = $1`,
      [ratingId]
    );
    return { parkId: r.rows[0]?.park_id ?? null, parkName: r.rows[0]?.park_name ?? null };
  } catch {
    return { parkId: null, parkName: null };
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ratingId = searchParams.get("ratingId");

    if (!ratingId) {
      return NextResponse.json({ error: "ratingId is required" }, { status: 400 });
    }

    let result;
    try {
      result = await pool.query(
        `SELECT category, text, image_url AS "imageUrl", image_layout AS "imageLayout", is_spoiler AS "isSpoiler", rating_id AS "ratingId"
         FROM parktexts WHERE rating_id = $1`,
        [ratingId]
      );
    } catch {
      // image_layout or is_spoiler column may not exist yet — fall back
      result = await pool.query(
        `SELECT category, text, image_url AS "imageUrl", rating_id AS "ratingId"
         FROM parktexts WHERE rating_id = $1`,
        [ratingId]
      );
    }

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error("DB error:", error);
    return NextResponse.json({ error: "Failed to fetch park texts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  revalidateContent();
  const { category, text, ratingId, imageUrl, imageLayout, isSpoiler } = await req.json();

  if (!category || !ratingId) {
    return NextResponse.json({ error: "Missing or invalid data" }, { status: 400 });
  }

  try {
    let result;
    // One row per (rating, category): a POST for a section that already exists updates it.
    const existing = await pool.query(
      `SELECT id FROM parktexts WHERE rating_id = $1 AND category = $2 ORDER BY id LIMIT 1`,
      [ratingId, category]
    );
    const existingId: number | undefined = existing.rows[0]?.id;
    try {
      result = existingId !== undefined
        ? await pool.query(
          `UPDATE parktexts SET text = $1, image_url = $2, image_layout = $3, is_spoiler = $4
           WHERE id = $5
           RETURNING category, text, image_url AS "imageUrl", image_layout AS "imageLayout", is_spoiler AS "isSpoiler", rating_id AS "ratingId"`,
          [text ?? "", imageUrl ?? null, imageLayout ?? null, isSpoiler ?? false, existingId]
        )
        : await pool.query(
          `INSERT INTO parktexts (rating_id, category, text, image_url, image_layout, is_spoiler)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING category, text, image_url AS "imageUrl", image_layout AS "imageLayout", is_spoiler AS "isSpoiler", rating_id AS "ratingId"`,
          [ratingId, category, text ?? "", imageUrl ?? null, imageLayout ?? null, isSpoiler ?? false]
        );
    } catch {
      result = existingId !== undefined
        ? await pool.query(
          `UPDATE parktexts SET text = $1, image_url = $2 WHERE id = $3
           RETURNING category, text, image_url AS "imageUrl", rating_id AS "ratingId"`,
          [text ?? "", imageUrl ?? null, existingId]
        )
        : await pool.query(
          `INSERT INTO parktexts (rating_id, category, text, image_url)
           VALUES ($1, $2, $3, $4)
           RETURNING category, text, image_url AS "imageUrl", rating_id AS "ratingId"`,
          [ratingId, category, text ?? "", imageUrl ?? null]
        );
    }

    const ctx = await ratingContext(ratingId);
    logChange({
      parkId: ctx.parkId,
      entityType: "park_text",
      entityId: ratingId,
      label: ctx.parkName,
      action: "create",
      summary: `Added "${category}" text`,
      details: { category, text: text ?? "", imageUrl: imageUrl ?? null, imageLayout: imageLayout ?? null, isSpoiler: isSpoiler ?? false },
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Database insert error:", error);
    return NextResponse.json({ error: "Failed to create park text" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  revalidateContent();
  const { category, text, ratingId, imageUrl, imageLayout, isSpoiler } = await req.json();

  if (!category || !ratingId) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const oldResult = await pool.query(
      `SELECT * FROM parktexts WHERE rating_id = $1 AND category = $2`,
      [ratingId, category]
    );
    const oldRow = oldResult.rows[0];

    let result;
    try {
      result = await pool.query(
        `UPDATE parktexts
         SET text = $1, image_url = $2, image_layout = $3, is_spoiler = $4
         WHERE rating_id = $5 AND category = $6
         RETURNING category, text, image_url AS "imageUrl", image_layout AS "imageLayout", is_spoiler AS "isSpoiler", rating_id AS "ratingId"`,
        [text ?? "", imageUrl ?? null, imageLayout ?? null, isSpoiler ?? false, ratingId, category]
      );
    } catch {
      result = await pool.query(
        `UPDATE parktexts
         SET text = $1, image_url = $2
         WHERE rating_id = $3 AND category = $4
         RETURNING category, text, image_url AS "imageUrl", rating_id AS "ratingId"`,
        [text ?? "", imageUrl ?? null, ratingId, category]
      );
    }

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Text entry not found for this specific visit" }, { status: 404 });
    }

    if (oldRow) {
      const diff = diffFields(
        oldRow,
        { text: text ?? "", imageUrl: imageUrl ?? null, imageLayout: imageLayout ?? null, isSpoiler: isSpoiler ?? false },
        { imageUrl: "image_url", imageLayout: "image_layout", isSpoiler: "is_spoiler" }
      );
      if (Object.keys(diff).length > 0) {
        const ctx = await ratingContext(ratingId);
        const changed = Object.keys(diff)
          .map((f) => (f === "text" ? "text" : f === "imageUrl" ? "image" : f === "isSpoiler" ? "spoiler status" : "layout"))
          .join(", ");
        logChange({
          parkId: ctx.parkId,
          entityType: "park_text",
          entityId: ratingId,
          label: ctx.parkName,
          action: "update",
          summary: `Edited "${category}" ${changed}`,
          details: { category, ...diff },
        });
      }
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Database update error:", error);
    return NextResponse.json({ error: "Failed to update park text" }, { status: 500 });
  }
}