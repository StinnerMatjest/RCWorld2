import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET() {
    try {
        const sql = `
            SELECT rm.*, rt.name as ride_type_name, m.name as manufacturer_name
            FROM ride_models rm
            LEFT JOIN ride_types rt ON rm.ride_type_id = rt.id
            LEFT JOIN manufacturers m ON rm.manufacturer_id = m.id
            ORDER BY rm.name ASC;
        `;
        const result = await pool.query(sql);

        return NextResponse.json({ rideModels: result.rows });
    } catch (error) {
        console.error("Ride Models GET Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            name,
            ride_type_id,
            manufacturer_id,
            year,
            in_production,
            history,
            note
        } = body;

        // Convert the 4-digit year into a format PostgreSQL's date type accepts
        const formattedYear = year ? `${year}-01-01` : null;

        const sql = `
            INSERT INTO ride_models (
                name, 
                ride_type_id, 
                manufacturer_id, 
                year, 
                in_production, 
                history, 
                note
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;

        const values = [
            name,
            ride_type_id,
            manufacturer_id,
            formattedYear,
            in_production ?? true,
            history,
            note
        ];

        const result = await pool.query(sql, values);

        return NextResponse.json({ rideModel: result.rows[0] }, { status: 201 });
    } catch (error) {
        console.error("Ride Models POST Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}