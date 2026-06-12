import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { isAdminRequest } from "@/app/lib/adminAuth";

// Admin-only feed of content changes. GETs pass through the middleware
// unguarded, so this route checks the admin cookie itself.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = req.nextUrl.searchParams;
    const parkId = params.get("parkId");
    const types = params.get("types"); // comma-separated entity_type values
    const limit = Math.min(Number(params.get("limit")) || 50, 200);
    const before = params.get("before"); // cursor: changelog id

    const where: string[] = [];
    const values: unknown[] = [];

    if (parkId) {
      values.push(Number(parkId));
      where.push(`c.park_id = $${values.length}`);
    }
    if (types) {
      values.push(types.split(","));
      where.push(`c.entity_type = ANY($${values.length})`);
    }
    if (before) {
      values.push(Number(before));
      where.push(`c.id < $${values.length}`);
    }

    values.push(limit + 1);

    const result = await pool.query(
      `SELECT c.id, c.created_at AS "createdAt", c.park_id AS "parkId",
              c.entity_type AS "entityType", c.entity_id AS "entityId",
              c.entity_label AS "entityLabel", c.action, c.summary, c.details,
              p.name AS "parkName", p.slug AS "parkSlug"
       FROM changelog c
       LEFT JOIN parks p ON p.id = c.park_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY c.id DESC
       LIMIT $${values.length}`,
      values
    );

    const hasMore = result.rows.length > limit;
    const entries = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore ? entries[entries.length - 1].id : null;

    return NextResponse.json({ entries, nextCursor }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch changelog:", error);
    return NextResponse.json({ error: "Failed to fetch changelog" }, { status: 500 });
  }
}
