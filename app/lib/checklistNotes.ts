import { pool } from "@/app/lib/db";
import { logChange } from "@/app/lib/changelog";

/**
 * Copy the per-category notes written in a park's visit checklist into the
 * rating's review sections (parktexts), so a freshly created park page already
 * carries the notes as its section text. Only sections that have no text yet
 * are filled — a written review is never overwritten.
 *
 * Picks the checklist by `checklistSlug` when given (and it belongs to the park),
 * otherwise the park's most recently finished checklist that has notes.
 * Never throws: a failure here must not fail the rating request.
 */
export async function seedParkTextsFromChecklist(opts: {
  ratingId: number | string;
  parkId: number | string;
  checklistSlug?: string | null;
}): Promise<string[]> {
  const { ratingId, parkId, checklistSlug } = opts;
  try {
    const cl = await pool.query<{ slug: string; notes: Record<string, unknown> }>(
      `SELECT slug, COALESCE(notes, '{}'::jsonb) AS notes
       FROM checklists
       WHERE park_id = $1
         AND notes IS NOT NULL AND notes::text <> '{}'
         AND ($2::text IS NULL OR slug = $2)
       ORDER BY (slug = $2) DESC, is_finished DESC, visit_end DESC NULLS LAST, id DESC
       LIMIT 1`,
      [parkId, checklistSlug ?? null]
    );
    const checklist = cl.rows[0];
    if (!checklist) return [];

    const existing = await pool.query<{ id: number; category: string; text: string | null }>(
      `SELECT id, category, text FROM parktexts WHERE rating_id = $1 ORDER BY id`,
      [ratingId]
    );
    const written = new Set(existing.rows.filter(r => (r.text ?? "").trim()).map(r => r.category));
    const emptyRowByCategory = new Map<string, number>();
    for (const r of existing.rows) {
      if (!written.has(r.category) && !emptyRowByCategory.has(r.category)) emptyRowByCategory.set(r.category, r.id);
    }

    const seeded: string[] = [];
    for (const [category, raw] of Object.entries(checklist.notes)) {
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text || written.has(category)) continue;
      const emptyId = emptyRowByCategory.get(category);
      if (emptyId !== undefined) {
        await pool.query(`UPDATE parktexts SET text = $1 WHERE id = $2`, [text, emptyId]);
      } else {
        await pool.query(
          `INSERT INTO parktexts (rating_id, category, text) VALUES ($1, $2, $3)`,
          [ratingId, category, text]
        );
      }
      seeded.push(category);
    }

    if (seeded.length > 0) {
      const park = await pool.query<{ name: string }>(`SELECT name FROM parks WHERE id = $1`, [parkId]);
      logChange({
        parkId: Number(parkId),
        entityType: "park_text",
        entityId: Number(ratingId),
        label: park.rows[0]?.name ?? null,
        action: "create",
        summary: `Filled ${seeded.length} review section${seeded.length === 1 ? "" : "s"} from checklist notes`,
        details: { checklist: checklist.slug, categories: seeded },
      });
    }
    return seeded;
  } catch (error) {
    console.error("Failed to seed park texts from checklist notes:", error);
    return [];
  }
}
