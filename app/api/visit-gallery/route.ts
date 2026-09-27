import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const query = `
      SELECT 
        vg.id, 
        vg.path, 
        vg.title, 
        p.name AS park_name
      FROM visitgallery vg
      LEFT JOIN visits v ON vg.visit_id = v.id
      LEFT JOIN parks p ON v.park_id = p.id
      ORDER BY vg.id DESC
    `;
        const result = await pool.query(query);
        return NextResponse.json({ images: result.rows }, { status: 200 });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json({ error: "Failed to fetch gallery images" }, { status: 500 });
    }
}