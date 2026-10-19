import { pool } from "@/app/lib/db";

// Tiebreak: the two admins settle the order of coasters that share a score,
// live, each on their own phone (app/tiebreak, app/api/tiebreak).
//
// The result is rollercoasters.tie_rank: the coaster's position inside its
// score group (1 = best of that score), kept dense 1..k over the placed
// coasters; unplaced ones are NULL. Scores never change here. The site's
// ranking (app/utils/ranking.ts) sorts by rating, then tie_rank, then the old
// fallbacks, so settled groups get a real order and unsettled ones behave
// exactly as before.
//
// Tables (created on first use):
//   tiebreak_groups   one row per score being worked on: round, picks {player: coasterId}, revealed
//                     (mode is a leftover column from the first version, unused)
//   tiebreak_log      every settled round: match / caved / split / lock / auto
//   tiebreak_players  who is around (name, last_seen) for the presence dots

let ready: Promise<void> | null = null;
export function ensureTiebreak(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await pool.query(`ALTER TABLE rollercoasters ADD COLUMN IF NOT EXISTS tie_rank INTEGER`);
      await pool.query(`CREATE TABLE IF NOT EXISTS tiebreak_groups (
        score NUMERIC PRIMARY KEY,
        mode TEXT NOT NULL DEFAULT 'list',
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

export type GroupRow = { score: string; round: number; picks: Record<string, number>; revealed: boolean; updated_at: string };

export async function getGroup(score: number): Promise<GroupRow> {
  const r = await pool.query<GroupRow>(
    `INSERT INTO tiebreak_groups (score) VALUES ($1)
     ON CONFLICT (score) DO UPDATE SET score = EXCLUDED.score
     RETURNING score, round, picks, revealed, updated_at`,
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

/** Placed coasters of a group, top first. */
async function placedIds(score: number): Promise<number[]> {
  const r = await pool.query(`SELECT id FROM rollercoasters WHERE rating = $1 AND tie_rank IS NOT NULL ORDER BY tie_rank, name`, [score]);
  return r.rows.map(x => x.id);
}

/** Write a dense 1..k order for the given ids (top first). */
async function writeOrder(score: number, ids: number[]) {
  for (let i = 0; i < ids.length; i++) {
    await pool.query(`UPDATE rollercoasters SET tie_rank = $1 WHERE id = $2 AND rating = $3`, [i + 1, ids[i], score]);
  }
}

/**
 * Put a coaster into the agreed list at `position` (1 = top; null/too big = bottom).
 * If exactly one coaster is left unplaced afterwards, it goes to the bottom by itself.
 */
export async function place(score: number, coasterId: number, position: number | null) {
  const ids = (await placedIds(score)).filter(id => id !== coasterId);
  const k = position == null ? ids.length : Math.min(Math.max(position, 1), ids.length + 1) - 1;
  ids.splice(k, 0, coasterId);
  await writeOrder(score, ids);
  const rest = await pool.query(`SELECT id FROM rollercoasters WHERE rating = $1 AND tie_rank IS NULL`, [score]);
  let auto: number | null = null;
  if (rest.rowCount === 1) { auto = rest.rows[0].id; await writeOrder(score, [...ids, auto!]); }
  return { slot: k + 1, auto };
}

/** Move a placed coaster one step up (dir -1) or down (dir +1). */
export async function move(score: number, coasterId: number, dir: number) {
  const ids = await placedIds(score);
  const i = ids.indexOf(coasterId); const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= ids.length) return false;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await writeOrder(score, ids);
  return true;
}

export async function unplace(score: number, coasterId: number) {
  await pool.query(`UPDATE rollercoasters SET tie_rank = NULL WHERE id = $1 AND rating = $2`, [coasterId, score]);
  await writeOrder(score, await placedIds(score));
}

/** "Start this group over": the order, the round and the group's history on the scoreboard. */
export async function resetGroup(score: number) {
  await pool.query(`UPDATE rollercoasters SET tie_rank = NULL WHERE rating = $1`, [score]);
  await pool.query(`UPDATE tiebreak_groups SET picks = '{}'::jsonb, revealed = false, round = 1, updated_at = now() WHERE score = $1`, [score]);
  await pool.query(`DELETE FROM tiebreak_log WHERE score = $1`, [score]);
}

export async function newRound(score: number, logResult: { result: string; coasterId?: number | null; cavedBy?: string | null } | null) {
  const g = await getGroup(score);
  if (logResult) {
    await pool.query(`INSERT INTO tiebreak_log (score, round, mode, picks, result, coaster_id, caved_by) VALUES ($1,$2,'list',$3,$4,$5,$6)`,
      [score, g.round, JSON.stringify(g.picks), logResult.result, logResult.coasterId ?? null, logResult.cavedBy ?? null]);
  }
  await pool.query(`UPDATE tiebreak_groups SET picks = '{}'::jsonb, revealed = false, round = round + 1, updated_at = now() WHERE score = $1`, [score]);
}

export async function logAuto(score: number, coasterId: number) {
  const g = await getGroup(score);
  await pool.query(`INSERT INTO tiebreak_log (score, round, mode, picks, result, coaster_id) VALUES ($1,$2,'list','{}'::jsonb,'auto',$3)`, [score, g.round, coasterId]);
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
