import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN!;
const PAGE_ID    = process.env.META_PAGE_ID!;
const IG_ID      = process.env.META_INSTAGRAM_ID!;
const GRAPH      = "https://graph.facebook.com/v21.0";


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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { platforms, ig_image_url } = await req.json() as {
    platforms: ("facebook" | "instagram")[];
    ig_image_url?: string;
  };

  const row = await pool.query(`SELECT * FROM social_posts WHERE id = $1`, [id]);
  if (!row.rows[0]) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const post = row.rows[0];
  const message = `${post.caption}\n\n${post.hashtags}`;
  const updates: Record<string, string | string[]> = {};
  const errors: string[] = [];

  if (platforms.includes("facebook")) {
    try {
      updates.fb_post_id = await postToFacebook(post.image_url, message);
    } catch (e) {
      errors.push(`Facebook: ${e}`);
    }
  }

  if (platforms.includes("instagram")) {
    try {
      updates.ig_post_id = await postToInstagram(ig_image_url ?? post.image_url, message);
    } catch (e) {
      errors.push(`Instagram: ${e}`);
    }
  }

  const publishedTo = [...(post.published_to ?? []), ...platforms.filter(p =>
    (p === "facebook" && updates.fb_post_id) || (p === "instagram" && updates.ig_post_id)
  )];

  await pool.query(
    `UPDATE social_posts
     SET fb_post_id = COALESCE($1, fb_post_id),
         ig_post_id = COALESCE($2, ig_post_id),
         published_to = $3,
         status = 'published',
         published_at = now()
     WHERE id = $4`,
    [updates.fb_post_id ?? null, updates.ig_post_id ?? null, publishedTo, id]
  );

  return NextResponse.json({ ok: errors.length === 0, errors, publishedTo });
}
