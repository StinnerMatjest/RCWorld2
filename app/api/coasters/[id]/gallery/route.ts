import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { revalidateContent } from "@/app/lib/revalidate";

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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  const client = await pool.connect();
  try {
    const { id } = await context.params;
    const coasterId = parseInt(id, 10);
    const { imageId } = await req.json();

    if (!imageId) return NextResponse.json({ error: "Missing imageId" }, { status: 400 });

    await client.query("BEGIN");

    // Remove the header flag from all images belonging to this coaster
    await client.query(`UPDATE coastergallery SET is_header = false WHERE coaster_id = $1`, [coasterId]);

    // Add the header flag exclusively to the selected image
    await client.query(`UPDATE coastergallery SET is_header = true WHERE id = $1 AND coaster_id = $2`, [imageId, coasterId]);

    await client.query("COMMIT");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to patch coaster header:", error);
    return NextResponse.json({ error: "Failed to set header" }, { status: 500 });
  } finally {
    client.release();
  }
}