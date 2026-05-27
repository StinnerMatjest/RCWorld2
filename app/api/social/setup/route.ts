import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function GET() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_posts (
      id           SERIAL PRIMARY KEY,
      status       TEXT        DEFAULT 'draft',
      caption      TEXT        NOT NULL,
      hashtags     TEXT        DEFAULT '',
      image_url    TEXT        NOT NULL,
      park_id      INT         REFERENCES parks(id),
      park_name    TEXT,
      coaster_id   INT         REFERENCES rollercoasters(id),
      coaster_name TEXT,
      reasoning    TEXT,
      fb_post_id   TEXT,
      ig_post_id   TEXT,
      published_to TEXT[]      DEFAULT '{}',
      created_at   TIMESTAMPTZ DEFAULT now(),
      published_at TIMESTAMPTZ
    )
  `);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS coaster_id INT REFERENCES rollercoasters(id)`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS coaster_name TEXT`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS category TEXT`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS scheduled_platforms TEXT[]`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  return NextResponse.json({ ok: true, message: "social_posts table ready" });
}
