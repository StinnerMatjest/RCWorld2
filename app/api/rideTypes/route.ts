import { NextResponse } from "next/server";
import { pool } from "@/app/lib/db";

export async function GET() {
    try {
        const sql = `SELECT * FROM ride_types ORDER BY name ASC;`;
        const result = await pool.query(sql);
        
        return NextResponse.json({ rideTypes: result.rows });
    } catch (error) {
        console.error("Ride Types GET Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, history, note } = body;

        const sql = `
            INSERT INTO ride_types (name, history, note)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        
        const result = await pool.query(sql, [name, history, note]);
        
        return NextResponse.json({ rideType: result.rows[0] }, { status: 201 });
    } catch (error) {
        console.error("Ride Types POST Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, name, history, note } = body;

        const sql = `
            UPDATE ride_types 
            SET name = $1, history = $2, note = $3
            WHERE id = $4
            RETURNING *;
        `;
        const result = await pool.query(sql, [name, history, note, id]);
        
        return NextResponse.json({ rideType: result.rows[0] }, { status: 200 });
    } catch (error) {
        console.error("Ride Types PUT Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        const { id } = body;

        const sql = `DELETE FROM ride_types WHERE id = $1 RETURNING *;`;
        const result = await pool.query(sql, [id]);
        
        return NextResponse.json({ success: true, deleted: result.rows[0] }, { status: 200 });
    } catch (error) {
        console.error("Ride Types DELETE Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}