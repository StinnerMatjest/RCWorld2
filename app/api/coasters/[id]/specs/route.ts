import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
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

        return NextResponse.json({ specs: result.rows[0], success: true });

    } catch (error: any) {
        console.error("Database Error:", error.message); 
        return NextResponse.json(
            { error: "Failed to update specs", details: error.message }, 
            { status: 500 }
        );
    }
}