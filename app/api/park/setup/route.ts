import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function GET() {
  await pool.query(`
    ALTER TABLE parks ADD COLUMN IF NOT EXISTS card_imagepath TEXT;
    ALTER TABLE parks ALTER COLUMN image_focus  TYPE TEXT;
    ALTER TABLE parks ALTER COLUMN header_focus TYPE TEXT;
    ALTER TABLE parktexts ADD COLUMN IF NOT EXISTS image_layout TEXT;
  `);
  return NextResponse.json({ ok: true, message: "Migration complete" });
}
