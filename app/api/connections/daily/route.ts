import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import type { ApiCoaster, Park } from "@/app/types";
import { getUsableCategories } from "@/app/components/connections/categories";
import { buildDailyPuzzleGroups } from "@/app/components/connections/generator";
import { toConnectionsCoasters } from "@/app/components/connections/utils";

// The day's Connections board, generated once on the server instead of in
// every visitor's browser. The generator is a brute-force search over the whole
// catalogue (and it runs for today plus two days back for the cooldown rule),
// which used to cost each player two catalogue downloads and several seconds
// of CPU on a phone. Here it runs once per day per mode and is cached in memory.
export const dynamic = "force-dynamic";

type Board = {
  groups: { id: string; label: string; difficulty: string; coasters: string[] }[];
  error: "NOT_ENOUGH_CATEGORIES" | "GENERATION_FAILED" | null;
  usableCategories: number;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const CACHE_TTL_MS = 10 * 60 * 1000; // admin category toggles show up within 10 min
const cache = new Map<string, { at: number; board: Promise<Board> }>();

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadCatalogue() {
  const [coastersRes, parksRes, disabledRes] = await Promise.all([
    fetch(`${BASE}api/coasters`, { cache: "force-cache", next: { tags: ["content"] } }),
    fetch(`${BASE}api/parks`, { cache: "force-cache", next: { tags: ["content"] } }),
    pool.query(`SELECT category_id FROM disabled_connections_categories`),
  ]);
  if (!coastersRes.ok || !parksRes.ok) throw new Error("catalogue unavailable");
  const coastersData = await coastersRes.json();
  const parksData = await parksRes.json();
  const coasters: ApiCoaster[] = Array.isArray(coastersData?.coasters) ? coastersData.coasters : [];
  const parks: Park[] = Array.isArray(parksData?.parks) ? parksData.parks : [];
  const disabled = new Set<string>(disabledRes.rows.map((r) => r.category_id));
  return { coasters: toConnectionsCoasters(coasters, parks), disabled };
}

async function buildBoard(date: string, admin: boolean): Promise<Board> {
  const { coasters, disabled } = await loadCatalogue();
  const usable = getUsableCategories(coasters, disabled, true);
  const result = buildDailyPuzzleGroups(usable, date);
  const groups = admin ? result.best : result.bestStandard;
  if (groups.length !== 4) {
    return {
      groups: [],
      error: usable.length < 4 ? "NOT_ENOUGH_CATEGORIES" : "GENERATION_FAILED",
      usableCategories: usable.length,
    };
  }
  return {
    groups: groups.map((g) => ({
      id: g.categoryId,
      label: g.label,
      difficulty: g.difficulty,
      coasters: g.coasters.map((c) => c.name),
    })),
    error: null,
    usableCategories: usable.length,
  };
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const admin = params.get("admin") === "1";
  const requested = params.get("date");
  // Players send their local date so the board rolls over at their midnight,
  // as it always has; anything outside yesterday..tomorrow (server time) is
  // refused so the cache can't be filled with arbitrary dates.
  const allowed = new Set([localDate(-1), localDate(0), localDate(1)]);
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : localDate(0);
  if (!allowed.has(date)) {
    return NextResponse.json({ error: "Date out of range" }, { status: 400 });
  }

  const key = `${date}:${admin ? "admin" : "std"}`;
  const hit = cache.get(key);
  const fresh = hit && Date.now() - hit.at < CACHE_TTL_MS;
  const boardPromise = fresh ? hit!.board : buildBoard(date, admin);
  if (!fresh) {
    cache.set(key, { at: Date.now(), board: boardPromise });
    boardPromise.catch(() => cache.delete(key));
    for (const k of cache.keys()) if (!k.startsWith(date) && !allowed.has(k.split(":")[0])) cache.delete(k);
  }

  try {
    const board = await boardPromise;
    return NextResponse.json(
      { date, ...board },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    );
  } catch (err) {
    console.error("connections/daily:", err);
    return NextResponse.json({ error: "Failed to build today's puzzle" }, { status: 500 });
  }
}
