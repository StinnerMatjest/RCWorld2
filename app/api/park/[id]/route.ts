import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { regenerateParkCuts } from "@/app/lib/cardCut";
import { pool } from "@/app/lib/db";
import { ensureVisitHeaderColumns } from "@/app/lib/visitHeader";
import { getImageSizes } from "@/app/lib/imageDims";
import { diffFields, logChange, FieldDiff } from "@/app/lib/changelog";
import { revalidateTag, revalidatePath } from "next/cache";

// Friendly wording for park field changes in the changelog timeline.
const PARK_FIELD_LABELS: Record<string, string> = {
  imagepath: "header image",
  cardImagepath: "card image",
  imageFocus: "image focus",
  headerFocus: "header focus",
  cardImages: "card images",
};

function summarizeParkDiff(diff: FieldDiff): string {
  return Object.keys(diff)
    .map((f) => PARK_FIELD_LABELS[f] ?? f)
    .join(", ");
}


export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const isNumeric = /^\d+$/.test(id);
    await ensureVisitHeaderColumns();

    const result = isNumeric
      ? await pool.query(
        `SELECT id, name, continent, country, city, imagepath, card_imagepath AS "cardImagepath", slug, image_focus AS "imageFocus", header_focus AS "headerFocus", header_focus_mobile AS "headerFocusMobile", card_images AS "cardImages" FROM parks WHERE id = $1`,
        [Number(id)]
      )
      : await pool.query(
        `SELECT id, name, continent, country, city, imagepath, card_imagepath AS "cardImagepath", slug, image_focus AS "imageFocus", header_focus AS "headerFocus", header_focus_mobile AS "headerFocusMobile", card_images AS "cardImages" FROM parks WHERE slug = $1`,
        [id]
      );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    // Header photo size lets the park page place the hero before hydration.
    const row = result.rows[0];
    const sizes = await getImageSizes([row.imagepath]);
    return NextResponse.json({ ...row, imageSize: sizes[row.imagepath] }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Failed to fetch park" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  try {
    const { id } = await context.params;
    const body = await req.json();
    const isNumeric = /^\d+$/.test(id);

    const oldResult = await pool.query(
      `SELECT * FROM parks WHERE ${isNumeric ? "id" : "slug"} = $1`,
      [isNumeric ? Number(id) : id]
    );
    const oldRow = oldResult.rows[0];

    // Build dynamic query to update only the fields provided in the body
    const fields = [];
    const values = [];
    let queryIdx = 1;

    if (body.name) { fields.push(`name = $${queryIdx++}`); values.push(body.name); }
    if (body.continent) { fields.push(`continent = $${queryIdx++}`); values.push(body.continent); }
    if (body.country) { fields.push(`country = $${queryIdx++}`); values.push(body.country); }
    if (body.city) { fields.push(`city = $${queryIdx++}`); values.push(body.city); }
    if (body.imagepath) { fields.push(`imagepath = $${queryIdx++}`); values.push(body.imagepath); }
    if (body.imageFocus !== undefined) { fields.push(`image_focus = $${queryIdx++}`); values.push(body.imageFocus); }
    if (body.headerFocus !== undefined) { fields.push(`header_focus = $${queryIdx++}`); values.push(body.headerFocus); }
    // The phone framing belongs to the photo: a new hero photo starts without one (it then follows the wide framing).
    if (body.headerFocusMobile !== undefined) { fields.push(`header_focus_mobile = $${queryIdx++}`); values.push(body.headerFocusMobile); }
    else if (body.imagepath && oldRow && body.imagepath !== oldRow.imagepath) { fields.push(`header_focus_mobile = NULL`); }
    if (body.cardImages !== undefined) { fields.push(`card_images = $${queryIdx++}`); values.push(JSON.stringify(body.cardImages)); }
    if (body.cardImagepath !== undefined) { fields.push(`card_imagepath = $${queryIdx++}`); values.push(body.cardImagepath); }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(isNumeric ? Number(id) : id);
    const condition = isNumeric ? `id = $${queryIdx}` : `slug = $${queryIdx}`;

    const query = `
      UPDATE parks
      SET ${fields.join(", ")}
      WHERE ${condition}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    if (oldRow) {
      const diff = diffFields(
        oldRow,
        {
          name: body.name || undefined,
          continent: body.continent || undefined,
          country: body.country || undefined,
          city: body.city || undefined,
          imagepath: body.imagepath || undefined,
          imageFocus: body.imageFocus,
          headerFocus: body.headerFocus,
          cardImages: body.cardImages,
          cardImagepath: body.cardImagepath,
        },
        {
          imageFocus: "image_focus",
          headerFocus: "header_focus",
          cardImages: "card_images",
          cardImagepath: "card_imagepath",
        }
      );
      if (Object.keys(diff).length > 0) {
        logChange({
          parkId: oldRow.id,
          entityType: "park",
          entityId: oldRow.id,
          label: oldRow.name,
          action: "update",
          summary: `Updated ${summarizeParkDiff(diff)}`,
          details: diff,
        });
      }
    }

    revalidateTag("parks-leaderboard"); // Clears the Parks Leaderboard cache

    if (body.imagepath || body.imageFocus !== undefined || body.cardImages !== undefined || body.cardImagepath !== undefined) {
      const row = result.rows[0];
      void regenerateParkCuts(row)
        .then(({ made, deleted }) => { if (made || deleted) revalidateContent(); })
        .catch((err) => console.error("card cut regeneration failed for park", row.id, err));
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error: any) {
    console.error("Database update error:", error);
    return NextResponse.json({ error: "Failed to update park", detail: error?.message ?? String(error) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  const client = await pool.connect();

  try {
    const { id } = await context.params;
    const isNumeric = /^\d+$/.test(id);
    const queryParam = isNumeric ? Number(id) : id;

    const getQuery = isNumeric
      ? `SELECT * FROM parks WHERE id = $1;`
      : `SELECT * FROM parks WHERE slug = $1;`;

    const result = await client.query(getQuery, [queryParam]);

    if (result.rowCount === 0) {
      client.release();
      return NextResponse.json({ error: "Park not found" }, { status: 404 });
    }

    const deleted = result.rows[0];
    const numericParkId = deleted.id;

    await client.query('BEGIN');

    // 1. Delete deeply nested visit data
    await client.query(`DELETE FROM parktexts WHERE visit_id IN (SELECT id FROM visits WHERE park_id = $1);`, [numericParkId]);
    await client.query(`DELETE FROM ratingwarning WHERE visit_id IN (SELECT id FROM visits WHERE park_id = $1);`, [numericParkId]);
    await client.query(`DELETE FROM visitgallery WHERE visit_id IN (SELECT id FROM visits WHERE park_id = $1);`, [numericParkId]);

    // 2. Delete deeply nested coaster data
    await client.query(`DELETE FROM coastergallery WHERE coaster_id IN (SELECT id FROM rollercoasters WHERE park_id = $1);`, [numericParkId]);
    await client.query(`DELETE FROM rollercoasterspecs WHERE coaster_id IN (SELECT id FROM rollercoasters WHERE park_id = $1);`, [numericParkId]);

    // 3. Delete immediate children and linked social posts
    await client.query(`DELETE FROM social_posts WHERE park_id = $1;`, [numericParkId]);
    await client.query(`DELETE FROM visits WHERE park_id = $1;`, [numericParkId]);
    await client.query(`DELETE FROM rollercoasters WHERE park_id = $1;`, [numericParkId]);

    // 4. Delete the park itself
    await client.query(`DELETE FROM parks WHERE id = $1;`, [numericParkId]);

    await client.query('COMMIT');

    logChange({
      parkId: numericParkId,
      entityType: "park",
      entityId: numericParkId,
      label: deleted.name,
      action: "delete",
      summary: `Deleted park ${deleted.name}`,
    });

    revalidateTag("parks-leaderboard");
    revalidatePath("/", "layout");
    client.release();
    return NextResponse.json(deleted, { status: 200 });

  } catch (error: any) {
    await client.query('ROLLBACK');
    client.release();

    console.error("Database delete error:", error);
    return NextResponse.json({ error: "Failed to delete park", detail: String(error) }, { status: 500 });
  }
}