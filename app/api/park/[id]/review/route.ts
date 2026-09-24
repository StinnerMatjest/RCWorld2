import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const result = await pool.query(
      `SELECT pt.category, pt.text, latest.date AS visit_date
       FROM parktexts pt
       JOIN (
         SELECT v.id, v.date
         FROM visits v
         JOIN parks p ON p.id = v.park_id
         WHERE v.published = TRUE
           AND (p.id::text = $1 OR p.slug = $1)
         ORDER BY v.date DESC
         LIMIT 1
       ) latest ON pt.visit_id = latest.id
       WHERE pt.text IS NOT NULL AND pt.text != ''`,
      [id]
    );

    const visitDate = result.rows[0]?.visit_date ?? null;
    return NextResponse.json({ texts: result.rows, date: visitDate });
  } catch (error) {
    console.error("Failed to fetch park review:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}