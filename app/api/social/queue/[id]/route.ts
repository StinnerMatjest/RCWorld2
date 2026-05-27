import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { caption, hashtags, image_url, scheduled_at, platforms, status: bodyStatus, ig_crop_url } = body;
  // "scheduled_at" key present in body means intentional set/clear
  const hasScheduledAt = Object.prototype.hasOwnProperty.call(body, "scheduled_at");
  const derivedStatus = hasScheduledAt
    ? (scheduled_at ? "scheduled" : "draft")
    : (bodyStatus ?? null);
  await pool.query(
    `UPDATE social_posts
     SET caption             = COALESCE($1, caption),
         hashtags            = COALESCE($2, hashtags),
         image_url           = COALESCE($3, image_url),
         scheduled_at        = CASE WHEN $8 THEN $4 ELSE scheduled_at END,
         scheduled_platforms = CASE WHEN $8 THEN $5 ELSE COALESCE($5, scheduled_platforms) END,
         status              = COALESCE($6, status),
         ig_crop_url         = COALESCE($9, ig_crop_url)
     WHERE id = $7`,
    [caption ?? null, hashtags ?? null, image_url ?? null, scheduled_at ?? null, platforms ?? null, derivedStatus, id, hasScheduledAt, ig_crop_url ?? null]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await pool.query(`UPDATE social_posts SET status = 'rejected' WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
