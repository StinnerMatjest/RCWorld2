import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { ROUNDS_PER_DAY } from "@/app/games/zoomle/constants";


function seededRng(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  return function () {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h = h >>> 0;
    return h / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Coasters that starred in the last N days are excluded from today's rounds
const EXCLUDE_RECENT_DAYS = 2;
// Fixed epoch anchor: every day's selection chain shares the same prefix, so
// "yesterday's answers" reconstructed today match what was actually served.
// (A rolling anchor would re-derive different histories on different days.)
const CHAIN_EPOCH = "2026-06-01";
const CHAIN_MAX_DAYS = 3650;

type Entry = { image_path: string; focal_index: number; focus: string; coaster_id: number; coaster_name: string; park_name: string; park_country: string };

function pickForDate(date: string, entries: Entry[], excluded: Set<number>): Entry[] {
  const shuffled = seededShuffle(entries, seededRng(`zoomle-${date}`));
  const selected: Entry[] = [];
  const coasterCount: Record<number, number> = {};
  const usedImages = new Set<string>();
  // Pass 0 honours the exclusion list; pass 1 relaxes it if the pool is too small
  for (const pass of [0, 1]) {
    for (const entry of shuffled) {
      if (selected.length >= ROUNDS_PER_DAY) break;
      if (pass === 0 && excluded.has(entry.coaster_id)) continue;
      const cc = coasterCount[entry.coaster_id] ?? 0;
      if (cc < 1 && !usedImages.has(entry.image_path)) {
        selected.push(entry);
        coasterCount[entry.coaster_id] = cc + 1;
        usedImages.add(entry.image_path);
      }
    }
    if (selected.length >= ROUNDS_PER_DAY) break;
  }
  return selected;
}

// Walk the selection chain from the epoch up to yesterday, then return the
// coaster ids picked in the most recent days.
function recentAnswerIds(date: string, entries: Entry[]): Set<number> {
  const days = Math.round(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${CHAIN_EPOCH}T00:00:00Z`).getTime()) / 86400000
  );
  const n = Math.min(days, CHAIN_MAX_DAYS);
  if (n <= 0) return new Set();
  const history: Set<number>[] = [];
  for (let i = n; i >= 1; i--) {
    const day = shiftDate(date, -i);
    const excluded = new Set(history.slice(-EXCLUDE_RECENT_DAYS).flatMap(s => [...s]));
    history.push(new Set(pickForDate(day, entries, excluded).map(e => e.coaster_id)));
  }
  return new Set(history.slice(-EXCLUDE_RECENT_DAYS).flatMap(s => [...s]));
}

export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date") ??
    new Date().toISOString().slice(0, 10);

  try {
    // Fetch all enabled pool images
    const [imagesRes, flagsRes, coastersRes] = await Promise.all([
      pool.query(`
        SELECT DISTINCT
          pg.id   AS gallery_id,
          pg.path AS image_path,
          COALESCE(zi.focuses, '[]'::jsonb) AS focuses,
          rc.id   AS coaster_id,
          rc.name AS coaster_name,
          p.name  AS park_name,
          p.country AS park_country,
          (pg.title ILIKE '%HEADER%') AS is_header
        FROM rollercoasters rc
        JOIN parks p ON p.id = rc.park_id
        JOIN parkgallery pg
          ON  pg.park_id = rc.park_id
          AND pg.title ILIKE '%' || rc.name || '%'
          AND pg.title NOT ILIKE '%HEADER ONLY%'
        LEFT JOIN zoomle_images zi
          ON  zi.coaster_id = rc.id
          AND zi.image_path = pg.path
        WHERE COALESCE(zi.enabled, TRUE) = TRUE
          AND COALESCE(rc.zoomle_enabled, TRUE) = TRUE
        ORDER BY rc.id, is_header DESC, pg.id ASC
      `),
      // Only apply flags created before today — same-day flags take effect tomorrow
      pool.query("SELECT image_path, focal_index FROM zoomle_flags WHERE created_at::date < $1::date", [date]),
      pool.query(`
        SELECT DISTINCT rc.id, rc.name, p.name AS park_name, p.country AS park_country
        FROM rollercoasters rc
        JOIN parks p ON p.id = rc.park_id
        JOIN parkgallery pg
          ON  pg.park_id = rc.park_id
          AND pg.title ILIKE '%' || rc.name || '%'
          AND pg.title NOT ILIKE '%HEADER ONLY%'
        WHERE COALESCE(rc.zoomle_enabled, TRUE) = TRUE
        ORDER BY rc.id
      `),
    ]);

    // Build flag set for fast lookup
    const flagSet = new Set(
      flagsRes.rows.map(r => `${r.image_path}::${r.focal_index}`)
    );

    // Expand each image into its placed focal entries (skip flagged).
    // Images with no focals set simply aren't in the pool.
    const allEntries: Entry[] = [];
    for (const img of imagesRes.rows) {
      const focals: string[] = Array.isArray(img.focuses) ? img.focuses : [];
      focals.forEach((focus, fi) => {
        if (!flagSet.has(`${img.image_path}::${fi}`)) {
          allEntries.push({
            image_path: img.image_path,
            focal_index: fi,
            focus,
            coaster_id: img.coaster_id,
            coaster_name: img.coaster_name,
            park_name: img.park_name,
            park_country: img.park_country,
          });
        }
      });
    }

    if (allEntries.length === 0) {
      return NextResponse.json({ rounds: [], date, total: 0 });
    }

    // Pick up to ROUNDS_PER_DAY (max 1 per coaster, max 1 per image),
    // avoiding coasters that were answers in the last EXCLUDE_RECENT_DAYS days
    const selected = pickForDate(date, allEntries, recentAnswerIds(date, allEntries));

    const coasterPool = coastersRes.rows;

    const rounds = selected.map((entry, i) => {
      const rngR = seededRng(`zoomle-${date}-round-${i}`);
      const others = seededShuffle(
        coasterPool.filter(c => c.id !== entry.coaster_id), rngR
      ).slice(0, 3);
      const options = seededShuffle(
        [
          { id: entry.coaster_id, name: entry.coaster_name, park_name: entry.park_name, park_country: entry.park_country },
          ...others.map(c => ({ id: c.id, name: c.name, park_name: c.park_name, park_country: c.park_country })),
        ],
        seededRng(`zoomle-${date}-order-${i}`)
      );
      return {
        image: entry.image_path,
        focus: entry.focus,
        focal_index: entry.focal_index,
        answer_id: entry.coaster_id,
        answer_name: entry.coaster_name,
        park_name: entry.park_name,
        park_country: entry.park_country,
        options,
      };
    });

    const uniqueImages = new Set(allEntries.map(e => e.image_path)).size;
    return NextResponse.json({ rounds, date, total: allEntries.length, uniqueImages });
  } catch (error) {
    console.error("zoomle daily error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
