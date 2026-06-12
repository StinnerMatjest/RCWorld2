import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";


const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN!;
const PAGE_ID    = process.env.META_PAGE_ID!;
const IG_ID      = process.env.META_INSTAGRAM_ID!;
const GRAPH      = "https://graph.facebook.com/v21.0";

function igCropUrl(url: string): string {
  const stripped = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${stripped}&w=1080&h=1080&fit=cover&q=90&output=jpg`;
}

async function postToFacebook(imageUrl: string, message: string) {
  const res = await fetch(`${GRAPH}/${PAGE_ID}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl, message, access_token: PAGE_TOKEN }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Facebook post failed");
  return data.post_id ?? data.id;
}

async function postToInstagram(imageUrl: string, caption: string) {
  const createRes = await fetch(`${GRAPH}/${IG_ID}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: PAGE_TOKEN }),
  });
  const createData = await createRes.json();
  if (!createRes.ok || createData.error) throw new Error(createData.error?.message ?? "Instagram media create failed");

  const publishRes = await fetch(`${GRAPH}/${IG_ID}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createData.id, access_token: PAGE_TOKEN }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok || publishData.error) throw new Error(publishData.error?.message ?? "Instagram publish failed");
  return publishData.id;
}

export async function GET(req: Request) {
  // Vercel Cron passes Authorization header; skip check in dev
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await pool.query(`
    SELECT * FROM social_posts
    WHERE status = 'scheduled'
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC
    LIMIT 10
  `);

  const results = [];
  for (const post of due.rows) {
    const platforms: string[] = post.scheduled_platforms ?? ["facebook", "instagram"];
    const message = `${post.caption}\n\n${post.hashtags}`;
    const errors: string[] = [];
    const updates: { fb?: string; ig?: string } = {};

    if (platforms.includes("facebook")) {
      try { updates.fb = await postToFacebook(post.image_url, message); }
      catch (e) { errors.push(`Facebook: ${e}`); }
    }
    if (platforms.includes("instagram")) {
      try { updates.ig = await postToInstagram(igCropUrl(post.image_url), message); }
      catch (e) { errors.push(`Instagram: ${e}`); }
    }

    const publishedTo = platforms.filter(p =>
      (p === "facebook" && updates.fb) || (p === "instagram" && updates.ig)
    );

    if (errors.length === 0) {
      await pool.query(
        `UPDATE social_posts
         SET fb_post_id = COALESCE($1, fb_post_id),
             ig_post_id = COALESCE($2, ig_post_id),
             published_to = $3,
             status = 'published',
             published_at = now()
         WHERE id = $4`,
        [updates.fb ?? null, updates.ig ?? null, publishedTo, post.id]
      );
    }

    results.push({ id: post.id, errors, publishedTo });
  }

  return NextResponse.json({ processed: results.length, results });
}
