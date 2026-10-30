import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { pool } from "@/app/lib/db";
import { revalidateContent } from "@/app/lib/revalidate";
import { logChange } from "@/app/lib/changelog";
import { regenerateParkCuts } from "@/app/lib/cardCut";
import { ensureVisitHeaderColumns } from "@/app/lib/visitHeader";

function validImage(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length < 2000 && (/^https:\/\//.test(v) || v.startsWith("/images/"));
}

/**
 * Set a visit's header photo (and crop). When the visit is the park's newest,
 * the park header follows it; older visits that never had a header of their
 * own are first pinned to the park header they were showing, so a revisit's
 * new photo never changes how an earlier visit looks.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const visitId = Number(id);
  if (!Number.isInteger(visitId) || visitId <= 0) {
    return NextResponse.json({ error: "Invalid visit id" }, { status: 400 });
  }
  let body: { imagepath?: unknown; focus?: unknown; focusMobile?: unknown; card?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const imagepath = body.imagepath === null ? null : validImage(body.imagepath) ? body.imagepath : undefined;
  if (imagepath === undefined) return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  const focus = typeof body.focus === "string" && body.focus.length <= 60 ? body.focus : null;
  // The tall phone framing: given, or kept while the photo stays, or dropped with a new photo.
  const focusMobileGiven = body.focusMobile === null || (typeof body.focusMobile === "string" && body.focusMobile.length <= 60);
  // The home card shows the header unless it has a photo of its own. "follow"
  // drops that own photo too, so the new header is used for both.
  const cardFollows = body.card === "follow";

  await ensureVisitHeaderColumns();
  const db = await pool.connect();
  let parkAfter: Record<string, unknown> | null = null;
  let parkName: string | null = null;
  let parkId: number;
  let syncedPark = false;
  let old: { header_imagepath: string | null; header_focus: string | null };
  let focusMobile: string | null = null;
  try {
    await db.query("BEGIN");
    const v = await db.query(
      `SELECT v.id, v.park_id, v.header_imagepath, v.header_focus, v.header_focus_mobile,
              p.name, p.imagepath AS park_imagepath, p.header_focus AS park_header_focus, p.header_focus_mobile AS park_header_focus_mobile, p.card_imagepath,
              (SELECT id FROM visits WHERE park_id = v.park_id ORDER BY date DESC, id DESC LIMIT 1) AS newest_id
       FROM visits v JOIN parks p ON p.id = v.park_id
       WHERE v.id = $1
       FOR UPDATE OF p`,
      [visitId]
    );
    if (v.rows.length === 0) {
      await db.query("ROLLBACK");
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }
    const row = v.rows[0];
    parkId = row.park_id;
    parkName = row.name;
    old = { header_imagepath: row.header_imagepath, header_focus: row.header_focus };
    focusMobile = focusMobileGiven ? (body.focusMobile as string | null) : imagepath && imagepath === row.header_imagepath ? row.header_focus_mobile ?? null : null;

    const isNewest = row.newest_id === visitId;
    if (isNewest && imagepath && (imagepath !== row.park_imagepath || focus !== (row.park_header_focus ?? null) || focusMobile !== (row.park_header_focus_mobile ?? null))) {
      // Older visits keep the photo they show today.
      await db.query(
        `UPDATE visits SET header_imagepath = $1, header_focus = $2, header_focus_mobile = $5
         WHERE park_id = $3 AND id <> $4 AND header_imagepath IS NULL`,
        [row.park_imagepath, row.park_header_focus, parkId, visitId, row.park_header_focus_mobile ?? null]
      );
      // A card without its own photo follows the header; its crop was made
      // for the old photo, so it starts centred on the new one.
      const newPhoto = imagepath !== row.park_imagepath;
      const cardPath = cardFollows ? null : row.card_imagepath;
      const p = await db.query(
        `UPDATE parks SET imagepath = $1, header_focus = $2, card_imagepath = $3, header_focus_mobile = $6,
                image_focus = CASE WHEN $5::boolean AND $3::text IS NULL THEN '0.5 0.5 1' ELSE image_focus END
         WHERE id = $4 RETURNING *`,
        [imagepath, focus, cardPath, parkId, newPhoto, focusMobile]
      );
      parkAfter = p.rows[0];
      syncedPark = true;
    }

    await db.query(
      `UPDATE visits SET header_imagepath = $1, header_focus = $2, header_focus_mobile = $4 WHERE id = $3`,
      [imagepath, imagepath ? focus : null, visitId, imagepath ? focusMobile : null]
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("Failed to set visit header:", error);
    return NextResponse.json({ error: "Failed to set visit header" }, { status: 500 });
  } finally {
    db.release();
  }

  logChange({
    parkId,
    entityType: "rating",
    entityId: visitId,
    label: parkName,
    action: "update",
    summary: syncedPark ? "Updated visit header (also the park header)" : "Updated visit header",
    details: {
      headerImagepath: { old: old.header_imagepath, new: imagepath },
      headerFocus: { old: old.header_focus, new: imagepath ? focus : null },
    },
  });

  revalidateContent();
  if (parkAfter) {
    revalidateTag("parks-leaderboard");
    const row = parkAfter as Parameters<typeof regenerateParkCuts>[0];
    void regenerateParkCuts(row)
      .then(({ made, deleted }) => { if (made || deleted) revalidateContent(); })
      .catch((err) => console.error("card cut regeneration failed for park", row.id, err));
  }

  return NextResponse.json({ success: true, headerImagepath: imagepath, headerFocus: imagepath ? focus : null, syncedPark });
}
