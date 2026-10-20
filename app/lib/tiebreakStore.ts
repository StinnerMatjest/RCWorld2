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
      await pool.query(`ALTER TABLE tiebreak_groups ADD COLUMN IF NOT EXISTS live_place JSONB`);
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
      // who placed last (the other one places the next match) and scores flagged as wrong during a session
      await pool.query(`ALTER TABLE tiebreak_groups ADD COLUMN IF NOT EXISTS last_placer TEXT`);
      await pool.query(`CREATE TABLE IF NOT EXISTS tiebreak_flags (
        coaster_id INTEGER PRIMARY KEY,
        dir TEXT NOT NULL,
        by_name TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )`);
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

/** Safety net: a coaster whose score changed is not in its new group's draft, so its old position must go. */
export async function sweepStale() {
  await pool.query(`UPDATE rollercoasters rc SET tie_rank = NULL
     WHERE rc.tie_rank IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM tiebreak_groups g WHERE g.score = rc.rating AND g.order_ids @> to_jsonb(rc.id))`);
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

export type Placing = { id: number; pos: number; by: string } | null;
export type GroupRow = { score: string; round: number; picks: Record<string, number>; revealed: boolean; order: number[]; placing: Placing; submitted_at: string | null; last_placer: string | null; updated_at: string };

/** The group row; the draft order is seeded from the published order the first time. */
export async function getGroup(score: number): Promise<GroupRow> {
  const r = await pool.query(
    `INSERT INTO tiebreak_groups (score) VALUES ($1)
     ON CONFLICT (score) DO UPDATE SET score = EXCLUDED.score
     RETURNING score, round, picks, revealed, order_ids, live_place AS placing, submitted_at, last_placer, updated_at`,
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
  return { score: row.score, round: row.round, picks: row.picks, revealed: row.revealed, order, placing: row.placing ?? null, submitted_at: row.submitted_at, last_placer: row.last_placer ?? null, updated_at: row.updated_at };
}

async function saveOrder(score: number, order: number[]) {
  await pool.query(`UPDATE tiebreak_groups SET order_ids = $2::jsonb, updated_at = now() WHERE score = $1`, [score, JSON.stringify(order)]);
}

export async function candidates(score: number) {
  const r = await pool.query(
    `SELECT rc.id, rc.name, rc.slug, rc.year, rc.model, rc.scale, rc.rating, rc.ridecount, rc.tie_rank, rc.isbestcoaster,
            m.name AS manufacturer, p.id AS park_id, p.name AS park, p.country, p.slug AS park_slug,
            rs.type, rs.classification, rs.length, rs.height, rs.drop, rs.speed, rs.inversions, rs.gforce, rs.duration_sec AS duration, rs.notes,
            img.path AS image, f.dir AS flag_dir, f.by_name AS flag_by,
            (SELECT MAX(v.date) FROM visits v WHERE v.park_id = p.id) AS last_visit
     FROM rollercoasters rc
     JOIN parks p ON p.id = rc.park_id
     LEFT JOIN manufacturers m ON m.id = rc.manufacturer_id
     LEFT JOIN rollercoasterspecs rs ON rs.coaster_id = rc.id
     LEFT JOIN tiebreak_flags f ON f.coaster_id = rc.id
     LEFT JOIN LATERAL (SELECT cg.path FROM coastergallery cg WHERE cg.coaster_id = rc.id AND cg.path <> '' ORDER BY cg.is_header DESC, cg.id ASC LIMIT 1) img ON TRUE
     WHERE rc.rating = $1
     ORDER BY rc.name`,
    [score]
  );
  return r.rows;
}

/** All score groups with more than one coaster: size, how many are in the draft list, whether the draft is on the site, and a few photos. */
export async function overview() {
  const rows = await pool.query<{ id: number; rating: string; tie_rank: number | null; image: string | null }>(
    `SELECT rc.id, rc.rating, rc.tie_rank, img.path AS image
     FROM rollercoasters rc
     LEFT JOIN LATERAL (SELECT cg.path FROM coastergallery cg WHERE cg.coaster_id = rc.id AND cg.path <> '' ORDER BY cg.is_header DESC, cg.id ASC LIMIT 1) img ON TRUE
     WHERE rc.rating IS NOT NULL ORDER BY rc.rating DESC, rc.tie_rank NULLS LAST, rc.name`
  );
  const groups = await pool.query<{ score: string; order_ids: number[] | null; submitted_at: string | null }>(`SELECT score, order_ids, submitted_at FROM tiebreak_groups`);
  const gmap = new Map(groups.rows.map(g => [Number(g.score), g]));
  const by = new Map<number, typeof rows.rows>();
  rows.rows.forEach(r => { const k = Number(r.rating); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); });
  const scores = [...by.keys()].sort((a, b) => b - a);
  let above = 0;
  const out: any[] = [];
  for (const s of scores) {
    const list = by.get(s)!; const g = gmap.get(s);
    if (list.length > 1) {
      const ids = new Set(list.map(x => x.id));
      const placed = g && g.order_ids ? g.order_ids.filter(id => ids.has(id)).length : list.filter(x => x.tie_rank != null).length;
      out.push({ score: s, count: list.length, published: list.filter(x => x.tie_rank != null).length, placed, above, submitted_at: g ? g.submitted_at : null, thumbs: list.map(x => x.image).filter(Boolean).slice(0, 6) });
    }
    above += list.length;
  }
  return out;
}

/**
 * Coasters that sit in a score group that was already submitted but are not in its list: added since, or
 * re-rated into the group. With the previous score from the site changelog when there is one.
 */
export async function additions() {
  const g = await pool.query<{ score: string; order_ids: number[] }>(`SELECT score, order_ids FROM tiebreak_groups WHERE submitted_at IS NOT NULL AND jsonb_array_length(COALESCE(order_ids, '[]'::jsonb)) > 0`);
  if (!g.rows.length) return [];
  const drafts = new Map(g.rows.map(r => [Number(r.score), new Set(r.order_ids)]));
  const rc = await pool.query(
    `SELECT rc.id, rc.name, rc.rating, p.name AS park, img.path AS image
     FROM rollercoasters rc JOIN parks p ON p.id = rc.park_id
     LEFT JOIN LATERAL (SELECT cg.path FROM coastergallery cg WHERE cg.coaster_id = rc.id AND cg.path <> '' ORDER BY cg.is_header DESC, cg.id ASC LIMIT 1) img ON TRUE
     WHERE rc.rating = ANY($1::numeric[])`, [[...drafts.keys()]]);
  const fresh = rc.rows.filter(r => !drafts.get(Number(r.rating))!.has(r.id));
  if (!fresh.length) return [];
  const ch = await pool.query<{ entity_id: number; details: any; created_at: string }>(
    `SELECT entity_id, details, created_at FROM changelog
     WHERE entity_type = 'coaster' AND entity_id = ANY($1::int[]) AND (details::jsonb) ? 'rating' ORDER BY created_at DESC`, [fresh.map(f => f.id)]);
  const latest = new Map<number, any>(); ch.rows.forEach(r => { if (!latest.has(r.entity_id)) latest.set(r.entity_id, r); });
  return fresh.map(f => { const l = latest.get(f.id); const d = l && l.details && l.details.rating; const from = d && typeof d === "object" && d !== null && "old" in d ? Number(d.old) : null;
    return { id: f.id, name: f.name, park: f.park, image: f.image, score: Number(f.rating), from: from != null && from !== Number(f.rating) ? from : null, at: l ? l.created_at : null }; });
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
  if (g.order.includes(coasterId)) { await setPlacing(score, null); return { slot: g.order.indexOf(coasterId) + 1, auto: null, already: true }; }
  const order = [...g.order];
  const k = position == null ? order.length : Math.min(Math.max(position, 1), order.length + 1) - 1;
  order.splice(k, 0, coasterId);
  const all = await pool.query<{ id: number }>(`SELECT id FROM rollercoasters WHERE rating = $1`, [score]);
  const rest = all.rows.map(x => x.id).filter(id => !order.includes(id));
  let auto: number | null = null;
  if (rest.length === 1) { auto = rest[0]; order.push(auto); }
  await saveOrder(score, order);
  await setPlacing(score, null);
  return { slot: k + 1, auto, already: false };
}

/** The live "X is dragging Y to position p" marker the other phone shows; null clears it. */
export async function setPlacing(score: number, p: Placing) {
  await pool.query(`UPDATE tiebreak_groups SET live_place = $2::jsonb, updated_at = now() WHERE score = $1`, [score, p ? JSON.stringify(p) : null]);
}

/** Replace the whole draft order (drag reorder). Only ids of this group, no duplicates; missing ones stay out. */
export async function reorder(score: number, ids: number[]) {
  const all = await pool.query<{ id: number }>(`SELECT id FROM rollercoasters WHERE rating = $1`, [score]);
  const ok = new Set(all.rows.map(x => x.id));
  const clean = [...new Set(ids.map(Number))].filter(id => ok.has(id));
  await saveOrder(score, clean);
  return clean;
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
  await pool.query(`UPDATE tiebreak_groups SET picks = '{}'::jsonb, revealed = false, round = 1, order_ids = '[]'::jsonb, live_place = NULL, submitted_at = NULL, updated_at = now() WHERE score = $1`, [score]);
  await pool.query(`DELETE FROM tiebreak_log WHERE score = $1`, [score]);
}

export async function newRound(score: number, logResult: { result: string; coasterId?: number | null; cavedBy?: string | null } | null) {
  const g = await getGroup(score);
  if (logResult) {
    await pool.query(`INSERT INTO tiebreak_log (score, round, mode, picks, result, coaster_id, caved_by) VALUES ($1,$2,'list',$3,$4,$5,$6)`,
      [score, g.round, JSON.stringify(g.picks), logResult.result, logResult.coasterId ?? null, logResult.cavedBy ?? null]);
  }
  await pool.query(`UPDATE tiebreak_groups SET picks = '{}'::jsonb, revealed = false, round = round + 1, live_place = NULL, updated_at = now() WHERE score = $1`, [score]);
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

/** Whoever placed last: the other one gets to place the next match. */
export async function setLastPlacer(score: number, name: string) {
  await pool.query(`UPDATE tiebreak_groups SET last_placer = $2 WHERE score = $1`, [score, name]);
}

/** "This score feels wrong": dir is 'high' or 'low', null removes the flag. */
export async function setFlag(coasterId: number, dir: string | null, by: string) {
  if (!dir) await pool.query(`DELETE FROM tiebreak_flags WHERE coaster_id = $1`, [coasterId]);
  else await pool.query(`INSERT INTO tiebreak_flags (coaster_id, dir, by_name) VALUES ($1, $2, $3) ON CONFLICT (coaster_id) DO UPDATE SET dir = EXCLUDED.dir, by_name = EXCLUDED.by_name, created_at = now()`, [coasterId, dir, by]);
}

/** The flagged coasters for the home screen, newest first. */
export async function flags() {
  const r = await pool.query(
    `SELECT f.coaster_id AS id, f.dir, f.by_name AS by, f.created_at, rc.name, rc.slug, rc.rating, p.name AS park, img.path AS image
     FROM tiebreak_flags f JOIN rollercoasters rc ON rc.id = f.coaster_id JOIN parks p ON p.id = rc.park_id
     LEFT JOIN LATERAL (SELECT cg.path FROM coastergallery cg WHERE cg.coaster_id = rc.id AND cg.path <> '' ORDER BY cg.is_header DESC, cg.id ASC LIMIT 1) img ON TRUE
     ORDER BY f.created_at DESC`);
  return r.rows;
}

/**
 * Everything the stats sheet shows for one coaster beyond the candidate row: the highs and lows,
 * the review sections, the featured photos, where it sits in its park, and how often we were there.
 */
export async function coasterDetail(id: number) {
  const [hl, tx, ph, pk, vs] = await Promise.all([
    pool.query(`SELECT category, severity FROM rollercoasterhighlights WHERE coaster_id = $1 ORDER BY id`, [id]),
    pool.query(`SELECT headline, text, is_spoiler AS "isSpoiler" FROM coastertext WHERE coaster_id = $1 ORDER BY "order", id`, [id]),
    pool.query(`SELECT path, featured, is_header FROM coastergallery WHERE coaster_id = $1 AND path <> '' ORDER BY is_header DESC, featured DESC, sort_order ASC, id ASC LIMIT 8`, [id]),
    pool.query(
      `SELECT rc2.id FROM rollercoasters rc JOIN rollercoasters rc2 ON rc2.park_id = rc.park_id AND rc2.rating IS NOT NULL
       WHERE rc.id = $1 ORDER BY rc2.rating DESC, rc2.tie_rank NULLS LAST, rc2.name`, [id]),
    pool.query(`SELECT COUNT(*)::int AS n, MAX(v.date) AS last FROM visits v JOIN rollercoasters rc ON rc.park_id = v.park_id WHERE rc.id = $1`, [id]),
  ]);
  const parkIds = pk.rows.map(r => r.id);
  return {
    highlights: hl.rows,
    texts: tx.rows,
    photos: ph.rows.map(r => r.path),
    parkRank: parkIds.indexOf(id) + 1 || null,
    parkTotal: parkIds.length,
    visits: vs.rows[0].n as number,
    lastVisit: vs.rows[0].last as string | null,
  };
}
