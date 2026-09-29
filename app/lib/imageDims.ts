import { pool } from "@/app/lib/db";

/** Pixel size of an original photo on R2, recorded at upload (see image_dimensions). */
export type ImageSize = { w: number; h: number };

/** R2 object key (file name) of a public R2 URL, or null for other sources. */
export function r2KeyOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\/(.+?)(?:\?.*)?$/i);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

/**
 * Sizes for a set of R2 URLs, keyed by the URL as given. URLs with no recorded
 * size (uploads that predate the table, videos, non-R2 sources) are simply
 * absent, and callers fall back to the size-guessing path.
 */
export async function getImageSizes(urls: (string | null | undefined)[]): Promise<Record<string, ImageSize>> {
  const byKey = new Map<string, string[]>();
  for (const u of urls) {
    const k = r2KeyOf(u);
    if (!k || !u) continue;
    const list = byKey.get(k) ?? [];
    list.push(u);
    byKey.set(k, list);
  }
  if (byKey.size === 0) return {};
  const res = await pool.query<{ key: string; width: number; height: number }>(
    "SELECT key, width, height FROM image_dimensions WHERE key = ANY($1)",
    [[...byKey.keys()]]
  );
  const out: Record<string, ImageSize> = {};
  for (const row of res.rows) {
    for (const u of byKey.get(row.key) ?? []) out[u] = { w: row.width, h: row.height };
  }
  return out;
}
