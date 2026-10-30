import { pool } from "@/app/lib/db";

// One review section per visit and category. Two rows for one section made the
// page show one and the editor the other; the index makes that impossible.
// Resolves to whether the index is there (inserts then use ON CONFLICT).
let ready: Promise<boolean> | null = null;
export function ensureParkTextsUnique(): Promise<boolean> {
  if (!ready) {
    ready = pool
      .query(`CREATE UNIQUE INDEX IF NOT EXISTS parktexts_visit_category_key ON parktexts (visit_id, category)`)
      .then(() => true)
      .catch((err) => {
        console.error("parktexts unique index not created", err);
        ready = null;
        return false;
      });
  }
  return ready;
}
