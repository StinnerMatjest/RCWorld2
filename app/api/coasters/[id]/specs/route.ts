import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { diffFields, describeDiff, getCoasterContext, logChange } from "@/app/lib/changelog";


export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
  revalidateContent();
    const { id } = await context.params;
    const coasterId = Number(id);

    try {
        const body = await req.json();
        
        // Helper to clean numbers: converts empty strings/NaN to null
        const toNum = (val: any) => (val === "" || val === null || isNaN(Number(val))) ? null : Number(val);
        const toInt = (val: any) => {
            const num = toNum(val);
            return num === null ? null : Math.round(num); // Ensure integers are integers
        };

        const {
            length,
            height,
            drop,
            speed,
            inversions,
            verticalAngle,
            gforce,
            duration,
            type,
            classification,
            notes
        } = body;

        const oldResult = await pool.query(
            `SELECT * FROM rollercoasterspecs WHERE coaster_id = $1`,
            [coasterId]
        );
        const oldRow = oldResult.rows[0];

        const query = `
            INSERT INTO rollercoasterspecs (
                coaster_id, length, height, drop, speed, inversions, 
                vertical_angle, gforce, duration_sec, type, classification, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (coaster_id) 
            DO UPDATE SET
                length = EXCLUDED.length,
                height = EXCLUDED.height,
                drop = EXCLUDED.drop,
                speed = EXCLUDED.speed,
                inversions = EXCLUDED.inversions,
                vertical_angle = EXCLUDED.vertical_angle,
                gforce = EXCLUDED.gforce,
                duration_sec = EXCLUDED.duration_sec,
                type = EXCLUDED.type,
                classification = EXCLUDED.classification,
                notes = EXCLUDED.notes
            RETURNING *;
        `;

        const values = [
            coasterId,
            toNum(length),
            toNum(height),
            toNum(drop),
            toNum(speed),
            toInt(inversions),
            toNum(verticalAngle),
            toNum(gforce),
            toInt(duration),
            type || null,
            classification || null,
            notes || null
        ];

        const result = await pool.query(query, values);

        const newRow = result.rows[0];
        const diff = diffFields(oldRow ?? {}, {
            length: newRow.length,
            height: newRow.height,
            drop: newRow.drop,
            speed: newRow.speed,
            inversions: newRow.inversions,
            verticalAngle: newRow.vertical_angle,
            gforce: newRow.gforce,
            duration: newRow.duration_sec,
            type: newRow.type,
            classification: newRow.classification,
            notes: newRow.notes,
        }, { verticalAngle: "vertical_angle", duration: "duration_sec" });

        if (Object.keys(diff).length > 0) {
            const ctx = await getCoasterContext(coasterId);
            logChange({
                parkId: ctx.parkId,
                entityType: "coaster_spec",
                entityId: coasterId,
                label: ctx.name,
                action: oldRow ? "update" : "create",
                summary: `${oldRow ? "Updated" : "Added"} specs for ${ctx.name ?? `coaster #${coasterId}`}: ${describeDiff(diff)}`,
                details: diff,
            });
        }

        return NextResponse.json({ specs: result.rows[0], success: true });

    } catch (error: any) {
        console.error("Database Error:", error.message); 
        return NextResponse.json(
            { error: "Failed to update specs", details: error.message }, 
            { status: 500 }
        );
    }
}