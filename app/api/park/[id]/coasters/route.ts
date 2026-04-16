import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const parkId = Number(id);

        if (isNaN(parkId)) {
            return NextResponse.json({ error: "Invalid park ID" }, { status: 400 });
        }

        console.log("Fetching coasters for park ID:", parkId);

        const query = `
      SELECT 
        rc.id, rc.name, rc.year, rc.manufacturer, rc.model, rc.scale, rc.haveridden, rc.isbestcoaster, rc.rcdbpath, rc.rating, rc.ridecount, rc.slug, rc.park_id,
        rs.type, rs.classification, rs.length, rs.height, rs.drop, rs.speed, rs.inversions, rs.vertical_angle, rs.gforce, rs.duration_sec AS duration, rs.notes
      FROM rollercoasters rc
      LEFT JOIN rollercoasterspecs rs ON rs.coaster_id = rc.id
      WHERE rc.park_id = $1
      ORDER BY rc.name;
    `;

        const result = await pool.query(query, [parkId]);
        const coasters = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            year: row.year,
            manufacturer: row.manufacturer,
            model: row.model,
            scale: row.scale,
            haveridden: row.haveridden,
            isbestcoaster: row.isbestcoaster,
            rcdbpath: row.rcdbpath,
            rideCount: Number(row.ridecount) || 0,
            ridecount: Number(row.ridecount) || 0,
            rating: row.rating,
            parkId: row.park_id,
            slug: row.slug,
            specs: {
                type: row.type,
                classification: row.classification,
                length: row.length,
                height: row.height,
                drop: row.drop,
                speed: row.speed,
                inversions: row.inversions,
                verticalAngle: row.vertical_angle,
                gforce: row.gforce,
                duration: row.duration,
                notes: row.notes,
            }
        }));

        return NextResponse.json(coasters, { status: 200 });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json(
            { error: "Failed to fetch roller coasters" },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: parkId } = await context.params;
        const body = await req.json();
        const {
            name,
            year,
            manufacturer,
            model,
            scale,
            haveridden,
            isbestcoaster,
            rcdbpath,
            rating,
            rideCount,
        } = body;

        if (
            !name ||
            !year ||
            !manufacturer ||
            !model ||
            !scale ||
            haveridden === undefined ||
            isbestcoaster === undefined ||
            !rcdbpath ||
            rating === undefined ||
            (haveridden && rideCount === undefined)
        ) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Default to 0 if not ridden
        const ratingInitial = haveridden
            ? Number.isNaN(Number(rating))
                ? 0
                : Number(rating)
            : 0;

        // Default to 0 if not ridden
        const rideCountInitial = haveridden
            ? Number.isNaN(Number(rideCount))
                ? 0
                : Number(rideCount)
            : 0;

        // --- Slug generation and committed duplicate handling ---
        let generatedSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        const slugCheck = await pool.query("SELECT id FROM rollercoasters WHERE slug = $1", [generatedSlug]);
        if (slugCheck.rowCount && slugCheck.rowCount > 0) {
            // Append Park ID for explicit duplicate worldwide
            generatedSlug = `${generatedSlug}-${parkId}`;
        }
        // --------------------------------------------------------

        const query = `
      INSERT INTO rollercoasters
        (park_id, name, year, manufacturer, model, scale, haveridden, isbestcoaster, rcdbpath, rating, ridecount, slug)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *;
    `;

        const result = await pool.query(query, [
            parkId,
            name,
            year,
            manufacturer,
            model,
            scale,
            haveridden,
            isbestcoaster,
            rcdbpath,
            ratingInitial,
            rideCountInitial,
            generatedSlug,
        ]);

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error("Database insert error:", error);
        return NextResponse.json(
            { error: "Failed to create roller coaster" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const parkId = Number(id);
        const body = await req.json();
        const { updates } = body;

        if (isNaN(parkId)) {
            return NextResponse.json({ error: "Invalid park ID" }, { status: 400 });
        }

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: "Invalid updates array" }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            for (const update of updates) {
                if (!update.id || !update.count) continue;

                // Add new count to existing ridecount and ensures haveridden is true
                await client.query(
                    "UPDATE rollercoasters SET ridecount = COALESCE(ridecount, 0) + $1, haveridden = true WHERE id = $2 AND park_id = $3",
                    [update.count, update.id, parkId]
                );
            }

            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Failed to sync coasters:", error);
        return NextResponse.json({ error: "Sync failed" }, { status: 500 });
    }
}