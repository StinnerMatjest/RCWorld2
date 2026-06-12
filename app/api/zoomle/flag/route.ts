import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";


// GET — fetch all flags (for config page)
export async function GET() {
  const result = await pool.query(
    "SELECT image_path, focal_index FROM zoomle_flags ORDER BY image_path, focal_index"
  );
  return NextResponse.json({ flags: result.rows });
}

// POST — flag a (image, focal_index) combo
export async function POST(req: NextRequest) {
  const { image_path, focal_index } = await req.json();
  await pool.query(
    "INSERT INTO zoomle_flags (image_path, focal_index) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [image_path, focal_index]
  );
  return NextResponse.json({ ok: true });
}

// DELETE — unflag a combo
export async function DELETE(req: NextRequest) {
  const { image_path, focal_index } = await req.json();
  await pool.query(
    "DELETE FROM zoomle_flags WHERE image_path = $1 AND focal_index = $2",
    [image_path, focal_index]
  );
  return NextResponse.json({ ok: true });
}
