import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { pool } from "@/app/lib/db";
import { regenerateParkCuts } from "@/app/lib/cardCut";
import { revalidateContent } from "@/app/lib/revalidate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Bring every park's card cuts up to date (after a geometry or copy-width change:
 * bump CARD_CUT.version, then call this). One park at a time; a park that fails is
 * reported and the rest go on. Admin only.
 *
 *   POST /api/admin/card-cuts            every park
 *   POST /api/admin/card-cuts?park=12    one park
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const only = Number(req.nextUrl.searchParams.get("park") || 0);
  const { rows } = await pool.query(
    `SELECT id, name, imagepath, card_imagepath, image_focus, card_images, card_cut FROM parks ${only ? "WHERE id = $1" : ""} ORDER BY id`,
    only ? [only] : [],
  );
  const parks: { id: number; name: string; made?: number; deleted?: number; error?: string }[] = [];
  let changed = false;
  for (const row of rows) {
    try {
      const r = await regenerateParkCuts(row);
      parks.push({ id: row.id, name: row.name, ...r });
      if (r.made || r.deleted) changed = true;
    } catch (err) {
      parks.push({ id: row.id, name: row.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (changed) revalidateContent();
  return NextResponse.json({ parks });
}
