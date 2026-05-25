import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { ROUNDS_PER_DAY, GRID_FOCUSES } from "@/app/games/zoomle/constants";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
          COALESCE(zi.focuses_override, '{}'::jsonb) AS focuses_override,
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
        FROM rollercoasters rc JOIN parks p ON p.id = rc.park_id
        WHERE COALESCE(rc.zoomle_enabled, TRUE) = TRUE ORDER BY rc.id
      `),
    ]);

    // Build flag set for fast lookup
    const flagSet = new Set(
      flagsRes.rows.map(r => `${r.image_path}::${r.focal_index}`)
    );

    // Expand each image × 9 grid positions (skip flagged)
    type Entry = { image_path: string; focal_index: number; focus: string; coaster_id: number; coaster_name: string; park_name: string; park_country: string };
    const allEntries: Entry[] = [];
    for (const img of imagesRes.rows) {
      for (let fi = 0; fi < GRID_FOCUSES.length; fi++) {
        if (!flagSet.has(`${img.image_path}::${fi}`)) {
          // Use custom override if set, otherwise fall back to grid default
          const overrides: Record<string, string> = img.focuses_override ?? {};
          const focus = overrides[String(fi)] ?? GRID_FOCUSES[fi];
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
      }
    }

    if (allEntries.length === 0) {
      return NextResponse.json({ rounds: [], date, total: 0 });
    }

    const rng = seededRng(`zoomle-${date}`);
    const shuffled = seededShuffle(allEntries, rng);

    // Pick up to ROUNDS_PER_DAY — max 2 per coaster, max 1 per image
    const selected: Entry[] = [];
    const coasterCount: Record<number, number> = {};
    const usedImages = new Set<string>();
    for (const entry of shuffled) {
      if (selected.length >= ROUNDS_PER_DAY) break;
      const cc = coasterCount[entry.coaster_id] ?? 0;
      if (cc < 1 && !usedImages.has(entry.image_path)) {
        selected.push(entry);
        coasterCount[entry.coaster_id] = cc + 1;
        usedImages.add(entry.image_path);
      }
    }

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
