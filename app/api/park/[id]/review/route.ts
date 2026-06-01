import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const result = await pool.query(
    `SELECT pt.category, pt.text, latest.date AS visit_date
     FROM parktexts pt
     JOIN (
       SELECT r.id, r.date
       FROM ratings r
       JOIN parks p ON p.id = r.park_id
       WHERE r.published = TRUE
         AND (p.id::text = $1 OR p.slug = $1)
       ORDER BY r.date DESC
       LIMIT 1
     ) latest ON pt.rating_id = latest.id
     WHERE pt.text IS NOT NULL AND pt.text != ''`,
    [id]
  );

  const visitDate = result.rows[0]?.visit_date ?? null;
  return NextResponse.json({ texts: result.rows, date: visitDate });
}
