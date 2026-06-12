import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET() {
  await pool.query(`
    ALTER TABLE parks ADD COLUMN IF NOT EXISTS card_imagepath TEXT;
    ALTER TABLE parks ALTER COLUMN image_focus  TYPE TEXT;
    ALTER TABLE parks ALTER COLUMN header_focus TYPE TEXT;
    ALTER TABLE parktexts ADD COLUMN IF NOT EXISTS image_layout TEXT;
    CREATE TABLE IF NOT EXISTS changelog (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      park_id INTEGER,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      entity_label TEXT,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      details JSONB
    );
    CREATE INDEX IF NOT EXISTS changelog_park_idx ON changelog (park_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS changelog_created_idx ON changelog (created_at DESC);
  `);
  return NextResponse.json({ ok: true, message: "Migration complete" });
}
