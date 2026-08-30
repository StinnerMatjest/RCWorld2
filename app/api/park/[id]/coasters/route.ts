import { NextRequest, NextResponse } from "next/server";
import { revalidateContent } from "@/app/lib/revalidate";
import { pool } from "@/app/lib/db";
import { getParkName, logChange } from "@/app/lib/changelog";

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
        rc.id, rc.name, rc.year, rc.manufacturer_id, m.name AS manufacturer_name, rc.model, rc.ride_model_id, rc.scale, rc.haveridden, rc.isbestcoaster, rc.rating, rc.ridecount, rc.slug, rc.park_id,
        rs.type, rs.classification, rs.length, rs.height, rs.drop, rs.speed, rs.inversions, rs.vertical_angle, rs.gforce, rs.duration_sec AS duration, rs.notes
      FROM rollercoasters rc
      LEFT JOIN manufacturers m ON rc.manufacturer_id = m.id
      LEFT JOIN rollercoasterspecs rs ON rs.coaster_id = rc.id
      WHERE rc.park_id = $1
      ORDER BY rc.name;
    `;

        const result = await pool.query(query, [parkId]);
        const coasters = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            year: row.year,
            manufacturerId: row.manufacturer_id,
            manufacturerName: row.manufacturer_name,
            model: row.model,
            rideModelId: row.ride_model_id, // NEW: Include relational ID
            scale: row.scale,
            haveridden: row.haveridden,
            isbestcoaster: row.isbestcoaster,
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
    revalidateContent();
    try {
        const { id: parkId } = await context.params;
        const body = await req.json();

        // Safety check: ensure parkId is a valid number, not "undefined"
        if (!parkId || parkId === "undefined" || isNaN(Number(parkId))) {
            return NextResponse.json({ error: `Invalid park ID: ${parkId}` }, { status: 400 });
        }

        const {
            name, year, manufacturerId, rideModelId, model, scale,
            haveridden, isbestcoaster, rating, rideCount, slug
        } = body;

        // Reverted to your strict validation
        if (
            !name || !year || !manufacturerId || !model || !scale ||
            haveridden === undefined || isbestcoaster === undefined ||
            (haveridden && rideCount === undefined)
        ) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const ratingInitial = haveridden ? (Number.isNaN(Number(rating)) ? 0 : Number(rating)) : 0;
        const rideCountInitial = haveridden ? (Number.isNaN(Number(rideCount)) ? 0 : Number(rideCount)) : 0;

        let generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        const slugCheck = await pool.query("SELECT id FROM rollercoasters WHERE slug = $1", [generatedSlug]);
        if (slugCheck.rowCount && slugCheck.rowCount > 0) {
            generatedSlug = `${generatedSlug}-${parkId}-${Math.floor(Math.random() * 1000)}`;
        }

        const query = `
      INSERT INTO rollercoasters
        (park_id, name, year, manufacturer_id, ride_model_id, model, scale, haveridden, isbestcoaster, rating, ridecount, slug)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *;
    `;

        // Sanitize integer columns from frontend string defaults
        const safeManufacturerId = manufacturerId === "Unknown" || manufacturerId === "" ? null : manufacturerId;
        const safeRideModelId = rideModelId === "Unknown" || rideModelId === "" ? null : rideModelId;

        const result = await pool.query(query, [
            parkId,
            name,
            year,
            safeManufacturerId,
            safeRideModelId,
            model || "Unknown",
            scale || "Unknown",
            haveridden,
            isbestcoaster,
            ratingInitial,
            rideCountInitial,
            generatedSlug,
        ]);

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error: any) {
        console.error("Database insert error:", error);
        // Expose the raw Postgres error (error.message) so it hits your frontend alert
        return NextResponse.json(
            { error: "Failed to create roller coaster", detail: error.message },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    revalidateContent();
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

        const applied = updates.filter((u) => u.id && u.count);
        if (applied.length > 0) {
            const totalRides = applied.reduce((sum, u) => sum + Number(u.count), 0);
            logChange({
                parkId,
                entityType: "coaster",
                entityId: null,
                label: await getParkName(parkId),
                action: "update",
                summary: `Synced ride counts (+${totalRides} ride${totalRides === 1 ? "" : "s"} across ${applied.length} coaster${applied.length === 1 ? "" : "s"})`,
                details: { updates: applied },
            });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Failed to sync coasters:", error);
        return NextResponse.json({ error: "Sync failed" }, { status: 500 });
    }
}