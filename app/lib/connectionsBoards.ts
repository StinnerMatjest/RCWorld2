import { pool } from "@/app/lib/db";
import type { ApiCoaster, Park } from "@/app/types";
import { getUsableCategories } from "@/app/components/connections/categories";
import { buildDailyPuzzleGroups } from "@/app/components/connections/generator";
import { toConnectionsCoasters } from "@/app/components/connections/utils";

// Pre-built daily Connections boards.
//
// Generating a board is a brute-force search over the whole catalogue (today
// plus two days back for the cooldown rule) and takes ~30 s on the Railway
// CPU. Building it on the first request of the day meant that player stared at
// a spinner for half a minute, and the old in-memory cache expired every ten
// minutes and on every deploy, so it happened all day long.
//
// Boards now live in Postgres. A scheduler started from instrumentation.ts
// builds today plus the next two days when the server starts and again at
// 00:01 every night, so players only ever read a finished board. Admin
// category toggles throw the stored boards away and rebuild them.

export type BoardGroup = { id: string; label: string; difficulty: string; coasters: string[] };
export type BoardError = "NOT_ENOUGH_CATEGORIES" | "GENERATION_FAILED" | null;
export type StoredBoard = {
  date: string;
  standard: BoardGroup[];
  admin: BoardGroup[];
  error: BoardError;
  usableCategories: number;
  builtAt: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
/** How many days ahead of today are kept built (today + DAYS_AHEAD). */
export const DAYS_AHEAD = 2;
/** Rows older than this are pruned. Yesterday must survive: players west of
 *  the server's timezone are still on it after the server's midnight. */
const KEEP_DAYS_BACK = 7;

export function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The dates that should always have a board ready. */
export function scheduledDates(): string[] {
  const out: string[] = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) out.push(localDate(i));
  return out;
}

/** Dates the API serves (yesterday..tomorrow relative to the server). */
export function servableDates(): Set<string> {
  return new Set([localDate(-1), localDate(0), localDate(1)]);
}

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS connections_boards (
           date TEXT PRIMARY KEY,
           standard JSONB NOT NULL,
           admin JSONB NOT NULL,
           usable_categories INTEGER NOT NULL,
           error TEXT,
           built_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

type BoardRow = {
  date: string;
  standard: BoardGroup[] | null;
  admin: BoardGroup[] | null;
  usable_categories: number | null;
  error: string | null;
  built_at: Date | string;
};

function rowToBoard(row: BoardRow): StoredBoard {
  return {
    date: row.date,
    standard: row.standard ?? [],
    admin: row.admin ?? [],
    error: (row.error as BoardError) ?? null,
    usableCategories: row.usable_categories ?? 0,
    builtAt: row.built_at instanceof Date ? row.built_at.toISOString() : String(row.built_at),
  };
}

export async function readBoard(date: string): Promise<StoredBoard | null> {
  await ensureTable();
  const res = await pool.query(`SELECT * FROM connections_boards WHERE date = $1`, [date]);
  return res.rows[0] ? rowToBoard(res.rows[0]) : null;
}

async function loadCatalogue() {
  const [coastersRes, parksRes, disabledRes] = await Promise.all([
    fetch(`${BASE}api/coasters`, { cache: "no-store" }),
    fetch(`${BASE}api/parks`, { cache: "no-store" }),
    pool.query(`SELECT category_id FROM disabled_connections_categories`),
  ]);
  if (!coastersRes.ok || !parksRes.ok) throw new Error("catalogue unavailable");
  const coastersData = await coastersRes.json();
  const parksData = await parksRes.json();
  const coasters: ApiCoaster[] = Array.isArray(coastersData?.coasters) ? coastersData.coasters : [];
  const parks: Park[] = Array.isArray(parksData?.parks) ? parksData.parks : [];
  if (coasters.length === 0) throw new Error("catalogue empty");
  const disabled = new Set<string>(disabledRes.rows.map((r) => r.category_id));
  return { coasters: toConnectionsCoasters(coasters, parks), disabled };
}

const toGroups = (groups: { categoryId: string; label: string; difficulty: string; coasters: { name: string }[] }[]): BoardGroup[] =>
  groups.map((g) => ({ id: g.categoryId, label: g.label, difficulty: g.difficulty, coasters: g.coasters.map((c) => c.name) }));

/** One generator run yields both modes, so a date is built once. */
async function generate(date: string): Promise<Omit<StoredBoard, "builtAt">> {
  const { coasters, disabled } = await loadCatalogue();
  const usable = getUsableCategories(coasters, disabled, true);
  const result = buildDailyPuzzleGroups(usable, date);
  const standard = result.bestStandard.length === 4 ? toGroups(result.bestStandard) : [];
  const admin = result.best.length === 4 ? toGroups(result.best) : [];
  const error: BoardError =
    standard.length === 4 && admin.length === 4 ? null : usable.length < 4 ? "NOT_ENOUGH_CATEGORIES" : "GENERATION_FAILED";
  return { date, standard, admin, error, usableCategories: usable.length };
}

// One build at a time (they are CPU-bound), and concurrent requests for the
// same date share the in-flight build instead of starting another.
const inFlight = new Map<string, Promise<StoredBoard>>();
let queue: Promise<unknown> = Promise.resolve();
// Bumped by invalidateBoards(); a build that started before a category change
// would store a stale board, so it re-runs when it sees the counter moved.
let generation = 0;

export function buildAndStore(date: string): Promise<StoredBoard> {
  const running = inFlight.get(date);
  if (running) return running;

  const job = queue
    .catch(() => undefined)
    .then(async () => {
      const started = Date.now();
      let built;
      let seen;
      do {
        seen = generation;
        built = await generate(date);
      } while (seen !== generation);
      await ensureTable();
      const res = await pool.query(
        `INSERT INTO connections_boards (date, standard, admin, usable_categories, error, built_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (date) DO UPDATE SET
           standard = EXCLUDED.standard, admin = EXCLUDED.admin,
           usable_categories = EXCLUDED.usable_categories, error = EXCLUDED.error, built_at = now()
         RETURNING *`,
        [date, JSON.stringify(built.standard), JSON.stringify(built.admin), built.usableCategories, built.error]
      );
      console.log(`connections: built board for ${date} in ${((Date.now() - started) / 1000).toFixed(1)} s${built.error ? ` (${built.error})` : ""}`);
      return rowToBoard(res.rows[0]);
    });
  queue = job;
  inFlight.set(date, job);
  job.finally(() => inFlight.delete(date)).catch(() => undefined);
  return job;
}

/** The board for a date: stored if we have it, otherwise built now. */
export async function getOrBuildBoard(date: string): Promise<StoredBoard> {
  const stored = await readBoard(date);
  if (stored) return stored;
  return buildAndStore(date);
}

/** Build every scheduled date that has no stored board yet. */
export async function ensureScheduledBoards(): Promise<void> {
  for (const date of scheduledDates()) {
    try {
      if (!(await readBoard(date))) await buildAndStore(date);
    } catch (err) {
      console.error(`connections: could not build board for ${date}:`, err);
    }
  }
  try {
    await pool.query(`DELETE FROM connections_boards WHERE date < $1`, [localDate(-KEEP_DAYS_BACK)]);
  } catch {
    /* pruning is best-effort */
  }
}

/**
 * Called when an admin enables or disables a category: the stored boards no
 * longer reflect the category set, so drop them and rebuild in the background.
 * Yesterday's board is left alone (players may be mid-game on it).
 */
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
export async function invalidateBoards(): Promise<void> {
  generation++;
  await ensureTable();
  await pool.query(`DELETE FROM connections_boards WHERE date >= $1`, [localDate(0)]);
  // Admins toggle several categories in a row; rebuild once they stop, not
  // three boards per click.
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    ensureScheduledBoards().catch((err) => console.error("connections: rebuild after category change failed:", err));
  }, 20_000);
  rebuildTimer.unref?.();
}

// ─── Scheduler (started once per server process from instrumentation.ts) ────

const globalForScheduler = globalThis as unknown as { connectionsSchedulerStarted?: boolean };

async function waitForCatalogue(): Promise<boolean> {
  // At process start the HTTP server may not be listening yet, and the
  // catalogue comes from our own API. Retry for a few minutes before giving up
  // (the first player request would then build on demand as a last resort).
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`${BASE}api/parks`, { cache: "no-store" });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

function msUntilNextRun(hour = 0, minute = 1): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function startConnectionsBoardScheduler(): void {
  if (globalForScheduler.connectionsSchedulerStarted) return;
  globalForScheduler.connectionsSchedulerStarted = true;
  if (!BASE) {
    console.warn("connections: NEXT_PUBLIC_API_BASE_URL unset, board scheduler not started");
    return;
  }

  const nightly = () => {
    ensureScheduledBoards().catch((err) => console.error("connections: nightly build failed:", err));
    const t = setTimeout(nightly, msUntilNextRun());
    t.unref?.();
  };

  void (async () => {
    if (await waitForCatalogue()) {
      await ensureScheduledBoards().catch((err) => console.error("connections: startup build failed:", err));
    } else {
      console.error("connections: catalogue never became reachable, boards will build on demand");
    }
    const t = setTimeout(nightly, msUntilNextRun());
    t.unref?.();
    console.log(`connections: board scheduler armed, next run in ${(msUntilNextRun() / 60000).toFixed(0)} min`);
  })();
}
