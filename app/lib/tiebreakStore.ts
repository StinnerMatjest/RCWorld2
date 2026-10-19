import { pool } from "@/app/lib/db";

// Tiebreak: the two admins settle the order of coasters that share a score,
// live, each on their own phone (app/tiebreak, app/api/tiebreak).
//
// The result is rollercoasters.tie_rank: the coaster's position inside its
// score group (1 = best of that score). Scores never change here. The site's
// ranking (app/utils/ranking.ts) sorts by rating, then tie_rank, then the old
// fallbacks (ride count, last ridden), so settled groups get a real order and
// unsettled ones behave exactly as before.
//
// Tables (created on first use):
//   tiebreak_groups   one row per score being worked on: mode (best|worst),
//                     round, picks {player: coasterId}, revealed
//   tiebreak_log      every settled round: match / caved / split / auto
//   tiebreak_players  who is around (name, last_seen) for the presence dots

export type Mode = "best" | "worst";

let ready: Promise<void> | null = null;
export function ensureTiebreak(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await pool.query(`ALTER TABLE rollercoasters ADD COLUMN IF NOT EXISTS tie_rank INTEGER`);
      await pool.query(`CREATE TABLE IF NOT EXISTS tiebreak_groups (
        score NUMERIC PRIMARY KEY,
        mode TEXT NOT NULL DEFAULT 'best',
        round INTEGER NOT NULL DEFAULT 1,
        picks JSONB NOT NULL DEFAULT '{}'::jsonb,
        revealed BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT now()
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS tiebreak_log (
        id SERIAL PRIMARY KEY,
        score NUMERIC NOT NULL,
        round INTEGER NOT NULL,
        mode TEXT NOT NULL,
        picks JSONB NOT NULL DEFAULT '{}'::jsonb,
        result TEXT NOT NULL,
        coaster_id INTEGER,
        caved_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS tiebreak_players (
        name TEXT PRIMARY KEY,
        last_seen TIMESTAMPTZ DEFAULT now()
      )`);
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

/** Only the tie_rank column, for the public coaster APIs (cheap, cached per process). */
let colReady: Promise<void> | null = null;
export function ensureTieRankColumn(): Promise<void> {
  if (!colReady) {
    colReady = pool.query(`ALTER TABLE rollercoasters ADD COLUMN IF NOT EXISTS tie_rank INTEGER`).then(() => undefined)
      .catch((err) => { colReady = null; throw err; });
  }
  return colReady;
}

export type GroupRow = { score: string; mode: Mode; round: number; picks: Record<string, number>; revealed: boolean; updated_at: string };

export async function getGroup(score: number): Promise<GroupRow> {
  const r = await pool.query<GroupRow>(
    `INSERT INTO tiebreak_groups (score) VALUES ($1)
     ON CONFLICT (score) DO UPDATE SET score = EXCLUDED.score
     RETURNING score, mode, round, picks, revealed, updated_at`,
    [score]
  );
  return r.rows[0];
}

export async function candidates(score: number) {
  const r = await pool.query(
    `SELECT rc.id, rc.name, rc.slug, rc.year, rc.model, rc.scale, rc.rating, rc.ridecount, rc.tie_rank, rc.isbestcoaster,
            m.name AS manufacturer, p.id AS park_id, p.name AS park, p.country, p.slug AS park_slug,
            rs.type, rs.classification, rs.length, rs.height, rs.drop, rs.speed, rs.inversions, rs.gforce, rs.duration_sec AS duration, rs.notes,
            img.path AS image,
            (SELECT MAX(v.date) FROM visits v WHERE v.park_id = p.id) AS last_visit
     FROM rollercoasters rc
     JOIN parks p ON p.id = rc.park_id
     LEFT JOIN manufacturers m ON m.id = rc.manufacturer_id
     LEFT JOIN rollercoasterspecs rs ON rs.coaster_id = rc.id
     LEFT JOIN LATERAL (SELECT cg.path FROM coastergallery cg WHERE cg.coaster_id = rc.id AND cg.path <> '' ORDER BY cg.is_header DESC, cg.id ASC LIMIT 1) img ON TRUE
     WHERE rc.rating = $1
     ORDER BY rc.tie_rank NULLS LAST, rc.name`,
    [score]
  );
  return r.rows;
}

/** All score groups with more than one coaster, with how many are placed. */
export async function overview() {
  const r = await pool.query(
    `SELECT rating AS score, COUNT(*)::int AS count, COUNT(tie_rank)::int AS placed,
            (SELECT COUNT(*)::int FROM rollercoasters x WHERE x.rating > rc.rating) AS above
     FROM rollercoasters rc WHERE rating IS NOT NULL
     GROUP BY rating HAVING COUNT(*) > 1 ORDER BY rating DESC`
  );
  return r.rows;
}

export async function countAbove(score: number) {
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM rollercoasters WHERE rating > $1`, [score]);
  return r.rows[0].n as number;
}

/** Next free slot from the top (best) or the bottom (worst) of the group. */
export async function nextSlot(score: number, mode: Mode): Promise<number | null> {
  const r = await pool.query(`SELECT COUNT(*)::int AS n, ARRAY_REMOVE(ARRAY_AGG(tie_rank), NULL) AS used FROM rollercoasters WHERE rating = $1`, [score]);
  const n: number = r.rows[0].n; const used = new Set<number>(r.rows[0].used || []);
  if (mode === "best") { for (let k = 1; k <= n; k++) if (!used.has(k)) return k; }
  else { for (let k = n; k >= 1; k--) if (!used.has(k)) return k; }
  return null;
}

export async function place(score: number, coasterId: number, mode: Mode) {
  const slot = await nextSlot(score, mode);
  if (slot === null) throw new Error("No free slot in this group");
  await pool.query(`UPDATE rollercoasters SET tie_rank = $1 WHERE id = $2 AND rating = $3`, [slot, coasterId, score]);
  // one left over: it takes the last free slot by itself
  const rest = await pool.query(`SELECT id FROM rollercoasters WHERE rating = $1 AND tie_rank IS NULL`, [score]);
  let auto: number | null = null;
  if (rest.rowCount === 1) {
    const last = await nextSlot(score, "best");
    if (last !== null) { auto = rest.rows[0].id; await pool.query(`UPDATE rollercoasters SET tie_rank = $1 WHERE id = $2`, [last, auto]); }
  }
  return { slot, auto };
}

export async function unplace(score: number, coasterId: number) {
  await pool.query(`UPDATE rollercoasters SET tie_rank = NULL WHERE id = $1 AND rating = $2`, [coasterId, score]);
}

export async function resetGroup(score: number) {
  await pool.query(`UPDATE rollercoasters SET tie_rank = NULL WHERE rating = $1`, [score]);
  await pool.query(`UPDATE tiebreak_groups SET picks = '{}'::jsonb, revealed = false, round = 1, updated_at = now() WHERE score = $1`, [score]);
}

export async function newRound(score: number, logResult: { result: string; coasterId?: number | null; cavedBy?: string | null } | null) {
  const g = await getGroup(score);
  if (logResult) {
    await pool.query(`INSERT INTO tiebreak_log (score, round, mode, picks, result, coaster_id, caved_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [score, g.round, g.mode, JSON.stringify(g.picks), logResult.result, logResult.coasterId ?? null, logResult.cavedBy ?? null]);
  }
  await pool.query(`UPDATE tiebreak_groups SET picks = '{}'::jsonb, revealed = false, round = round + 1, updated_at = now() WHERE score = $1`, [score]);
}

export async function logFor(score: number | null) {
  const r = score === null
    ? await pool.query(`SELECT l.*, rc.name AS coaster FROM tiebreak_log l LEFT JOIN rollercoasters rc ON rc.id = l.coaster_id ORDER BY l.id DESC LIMIT 300`)
    : await pool.query(`SELECT l.*, rc.name AS coaster FROM tiebreak_log l LEFT JOIN rollercoasters rc ON rc.id = l.coaster_id WHERE l.score = $1 ORDER BY l.id DESC`, [score]);
  return r.rows;
}

export async function seen(name: string) {
  await pool.query(`INSERT INTO tiebreak_players (name, last_seen) VALUES ($1, now()) ON CONFLICT (name) DO UPDATE SET last_seen = now()`, [name]);
}

export async function players() {
  const r = await pool.query(`SELECT name, last_seen FROM tiebreak_players ORDER BY last_seen DESC LIMIT 6`);
  return r.rows;
}
