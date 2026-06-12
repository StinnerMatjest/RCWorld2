import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { diffFields, logChange } from "@/app/lib/changelog";


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  try {
    const { id } = await params;
    const { title } = await req.json();

    const oldResult = await pool.query(
      `SELECT g.*, p.name AS park_name FROM parkgallery g LEFT JOIN parks p ON p.id = g.park_id WHERE g.id = $1`,
      [id]
    );
    const oldRow = oldResult.rows[0];

    const result = await pool.query(
      "UPDATE parkgallery SET title = $1 WHERE id = $2 RETURNING *",
      [title, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (oldRow) {
      const diff = diffFields(oldRow, { title });
      if (Object.keys(diff).length > 0) {
        logChange({
          parkId: oldRow.park_id,
          entityType: "image",
          entityId: Number(id),
          label: oldRow.park_name,
          action: "update",
          summary: `Renamed image "${oldRow.title}" to "${title}"`,
          details: diff,
        });
      }
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update image:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  revalidateContent();
  try {
    const { id } = await params;

    const oldResult = await pool.query(
      `SELECT g.*, p.name AS park_name FROM parkgallery g LEFT JOIN parks p ON p.id = g.park_id WHERE g.id = $1`,
      [id]
    );
    const oldRow = oldResult.rows[0];

    await pool.query("DELETE FROM parkgallery WHERE id = $1", [id]);

    if (oldRow) {
      logChange({
        parkId: oldRow.park_id,
        entityType: "image",
        entityId: Number(id),
        label: oldRow.park_name,
        action: "delete",
        summary: `Deleted image "${oldRow.title}"`,
        details: { title: oldRow.title, path: oldRow.path },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete image:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
