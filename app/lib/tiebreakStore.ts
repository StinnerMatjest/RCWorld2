import { pool } from "@/app/lib/db";

// Tiebreak: the two admins settle the order of coasters that share a score,
// live, each on their own phone (app/tiebreak, app/api/tiebreak).
//
// Two layers:
//   draft     tiebreak_groups.order_ids: the list the two of you are building (top first).
//             Placing, moving and removing only touch the draft.
//   published rollercoasters.tie_rank: what the site uses (1 = best of the score group, dense
//             1..k over the placed coasters, NULL = unplaced). Written only by submit().
// Scores never change here. The site's ranking (app/utils/ranking.ts) sorts by rating, then
// tie_rank, then the old fallbacks, so settled groups get a real order and unsettled ones behave
// exactly as before.
//
// Tables (created on first use):
//   tiebreak_groups   one row per score: round, picks {player: coasterId}, revealed, order_ids
//   tiebreak_log      every settled round: match / caved / split / lock / auto / submit
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
      await pool.query(`ALTER TABLE tiebreak_groups ADD COLUMN IF NOT EXISTS order_ids JSONB`);
      await pool.query(`ALTER TABLE tiebreak_groups ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`);
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

export type GroupRow = { score: string; round: number; picks: Record<string, number>; revealed: boolean; order: number[]; submitted_at: string | null; updated_at: string };

/** The group row; the draft order is seeded from the published order the first time. */
export async function getGroup(score: number): Promise<GroupRow> {
  const r = await pool.query(
    `INSERT INTO tiebreak_groups (score) VALUES ($1)
     ON CONFLICT (score) DO UPDATE SET score = EXCLUDED.score
     RETURNING score, round, picks, revealed, order_ids, submitted_at, updated_at`,
    [score]
  );
  const row = r.rows[0];
  const ids = await pool.query<{ id: number; tie_rank: number | null }>(`SELECT id, tie_rank FROM rollercoasters WHERE rating = $1`, [score]);
  const inGroup = new Set(ids.rows.map(x => x.id));
  let order: number[];
  if (row.order_ids == null) {
    order = ids.rows.filter(x => x.tie_rank != null).sort((a, b) => a.tie_rank! - b.tie_rank!).map(x => x.id);
    await pool.query(`UPDATE tiebreak_groups SET order_ids = $2::jsonb WHERE score = $1`, [score, JSON.stringify(order)]);
  } else {
    order = (row.order_ids as number[]).filter(id => inGroup.has(id)); // a coaster re-scored out of the group drops out
  }
  return { score: row.score, round: row.round, picks: row.picks, revealed: row.revealed, order, submitted_at: row.submitted_at, updated_at: row.updated_at };
}

async function saveOrder(score: number, order: number[]) {
  await pool.query(`UPDATE tiebreak_groups SET order_ids = $2::jsonb, updated_at = now() WHERE score = $1`, [score, JSON.stringify(order)]);
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
     ORDER BY rc.name`,
    [score]
  );
  return r.rows;
}

/** All score groups with more than one coaster: how many are in the draft list, and whether the draft is on the site. */
export async function overview() {
  const r = await pool.query(
    `SELECT rc.rating AS score, COUNT(*)::int AS count, COUNT(rc.tie_rank)::int AS published,
            COALESCE(jsonb_array_length(g.order_ids), 0)::int AS placed,
            (SELECT COUNT(*)::int FROM rollercoasters x WHERE x.rating > rc.rating) AS above,
            g.submitted_at
     FROM rollercoasters rc LEFT JOIN tiebreak_groups g ON g.score = rc.rating
     WHERE rc.rating IS NOT NULL
     GROUP BY rc.rating, g.order_ids, g.submitted_at HAVING COUNT(*) > 1 ORDER BY rc.rating DESC`
  );
  return r.rows;
}

export async function countAbove(score: number) {
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM rollercoasters WHERE rating > $1`, [score]);
  return r.rows[0].n as number;
}

/**
 * Put a coaster into the draft list at `position` (1 = top; null/too big = bottom).
 * If exactly one coaster is left out afterwards, it goes to the bottom by itself.
 */
export async function place(score: number, coasterId: number, position: number | null) {
  const g = await getGroup(score);
  const order = g.order.filter(id => id !== coasterId);
  const k = position == null ? order.length : Math.min(Math.max(position, 1), order.length + 1) - 1;
  order.splice(k, 0, coasterId);
  const all = await pool.query<{ id: number }>(`SELECT id FROM rollercoasters WHERE rating = $1`, [score]);
  const rest = all.rows.map(x => x.id).filter(id => !order.includes(id));
  let auto: number | null = null;
  if (rest.length === 1) { auto = rest[0]; order.push(auto); }
  await saveOrder(score, order);
  return { slot: k + 1, auto };
}

/** Move a listed coaster one step up (dir -1) or down (dir +1) in the draft. */
export async function move(score: number, coasterId: number, dir: number) {
  const g = await getGroup(score); const order = [...g.order];
  const i = order.indexOf(coasterId); const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= order.length) return false;
  [order[i], order[j]] = [order[j], order[i]];
  await saveOrder(score, order);
  return true;
}

export async function unplace(score: number, coasterId: number) {
  const g = await getGroup(score);
  await saveOrder(score, g.order.filter(id => id !== coasterId));
}

/** Publish the draft: tie_rank 1..k for the listed coasters, NULL for the rest of the group. */
export async function submit(score: number) {
  const g = await getGroup(score);
  await pool.query(`UPDATE rollercoasters SET tie_rank = NULL WHERE rating = $1`, [score]);
  for (let i = 0; i < g.order.length; i++) {
    await pool.query(`UPDATE rollercoasters SET tie_rank = $1 WHERE id = $2 AND rating = $3`, [i + 1, g.order[i], score]);
  }
  await pool.query(`UPDATE tiebreak_groups SET submitted_at = now(), updated_at = now() WHERE score = $1`, [score]);
  await pool.query(`INSERT INTO tiebreak_log (score, round, mode, picks, result) VALUES ($1,$2,'list','{}'::jsonb,'submit')`, [score, g.round]);
  return g.order;
}

/** "Start this group over": draft, published order, round and the group's history on the scoreboard. */
export async function resetGroup(score: number) {
  await pool.query(`UPDATE rollercoasters SET tie_rank = NULL WHERE rating = $1`, [score]);
  await pool.query(`UPDATE tiebreak_groups SET picks = '{}'::jsonb, revealed = false, round = 1, order_ids = '[]'::jsonb, submitted_at = NULL, updated_at = now() WHERE score = $1`, [score]);
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
