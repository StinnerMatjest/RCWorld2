/**
 * Parks and their roller coasters from RCDB (https://rcdb.com), read from its
 * pages: the quick search for picking a park when a checklist is made, and the
 * park's page for its operating coasters. RCDB has no API; these read the same
 * tables a person would copy from the site.
 */

const TIMEOUT = 10000;
const DAY = 24 * 3600 * 1000;

export type RcdbPark = { id: string; name: string; where: string; country: string };
export type RcdbCoaster = { id: string; name: string; year: number | null; scale: string | null };

/** The page, and where it ended up (the quick search jumps straight to the page of a single hit). */
async function getPage(url: string): Promise<{ html: string; url: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { "User-Agent": "ParkRating checklist (parkrating.com)" } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return { html: await res.text(), url: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

const text = (html: string) =>
  html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

/** "Gyeongju World / 경주월드" -> "Gyeongju World": the name in its own script goes. */
const plainName = (html: string) => text(html).replace(/\s+\/\s+[^/]*[^\u0000-ɏ][^/]*$/, "").trim();

const searchCache = new Map<string, { at: number; parks: RcdbPark[] }>();

/** Amusement parks whose name matches `q`, as RCDB's quick search lists them. */
export async function searchParks(q: string): Promise<RcdbPark[]> {
  const key = q.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.parks;
  const { html, url } = await getPage(`https://rcdb.com/qs.htm?qs=${encodeURIComponent(q.trim())}`);
  const parks: RcdbPark[] = [];
  const seen = new Set<string>();
  const places = (s: string) => [...s.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map(m => text(m[1]));
  // A single hit: its own page. A park's heading is followed by its places; a
  // coaster's by its park, then the park's places in brackets.
  const single = url.match(/\/(\d+)\.htm$/)?.[1];
  if (single) {
    const head = html.match(/<h1>([\s\S]*?)<\/h1>([\s\S]*?)<\/div>/);
    if (head) {
      const park = head[2].match(/^\s*<a href="?\/(\d+)\.htm"?>([\s\S]*?)<\/a>/);
      const where = [...head[2].matchAll(/<a href="\/location\.htm[^>]*>([\s\S]*?)<\/a>/g)].map(m => text(m[1]));
      parks.push({ id: park ? park[1] : single, name: plainName(park ? park[2] : head[1]), where: where.join(", "), country: where[where.length - 1] ?? "" });
    }
    searchCache.set(key, { at: Date.now(), parks });
    return parks;
  }
  // One <section> per kind of match; only the amusement park ones.
  for (const sec of html.split("<section>")) {
    const h3 = sec.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? "";
    if (!/amusement park/i.test(text(h3))) continue;
    for (const p of sec.matchAll(/<p><a href="?\/(\d+)\.htm"?>([\s\S]*?)<\/a>\s*\(([\s\S]*?)\)<\/p>/g)) {
      if (seen.has(p[1])) continue;
      seen.add(p[1]);
      const where = places(p[3]);
      parks.push({ id: p[1], name: plainName(p[2]), where: where.join(", "), country: where[where.length - 1] ?? "" });
    }
  }
  searchCache.set(key, { at: Date.now(), parks });
  return parks;
}

/** A park's operating roller coasters, with the year each opened. */
export async function parkCoasters(id: string): Promise<RcdbCoaster[]> {
  const { html } = await getPage(`https://rcdb.com/${encodeURIComponent(id)}.htm`);
  const start = html.indexOf("Operating Roller Coasters");
  if (start === -1) return [];
  const table = html.slice(start, html.indexOf("</table>", start));
  const out: RcdbCoaster[] = [];
  for (const row of table.split("<tr>").slice(1)) {
    const cells = row.split(/<td[^>]*>/).slice(1);
    const link = row.match(/<a href="?\/(\d+)\.htm"?>([\s\S]*?)<\/a>/);
    if (!link || cells.length < 5) continue;
    // Camera, name, type, design, scale, opened.
    const opened = row.match(/<time datetime="?(\d{4})/)?.[1];
    out.push({ id: link[1], name: plainName(link[2]), year: opened ? Number(opened) : null, scale: cells[4] ? text(cells[4]) || null : null });
  }
  return out;
}
