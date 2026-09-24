import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const parkId = parseInt(id, 10);

    if (isNaN(parkId)) return NextResponse.json({ gallery: [] });

    const res = await pool.query(
      `SELECT 
         vg.id, 
         vg.title, 
         vg.path, 
         vg.description, 
         vg.visit_id, 
         v.date AS visit_date
       FROM visitgallery vg
       JOIN visits v ON vg.visit_id = v.id
       WHERE v.park_id = $1
       ORDER BY v.date DESC, vg.id ASC`,
      [parkId]
    );

    return NextResponse.json({ gallery: res.rows });
  } catch (error) {
    console.error("Failed to fetch total park gallery:", error);
    return NextResponse.json({ error: "Failed to fetch gallery images" }, { status: 500 });
  }
}