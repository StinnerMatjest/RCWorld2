import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET() {
    try {
        const query = `
      SELECT id, slug, title, intro_text, created_at 
      FROM rankinglists 
      ORDER BY created_at DESC;
    `;

        const result = await pool.query(query);

        const rankingLists = result.rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            introText: row.intro_text,
            createdAt: row.created_at,
        }));

        return NextResponse.json({ rankingLists }, { status: 200 });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json({ error: "Failed to fetch ranking lists" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const client = await pool.connect();
    try {
        const body = await req.json();
        const { title, slug, introText, items } = body;

        await client.query("BEGIN");

        const listResult = await client.query(
            `INSERT INTO rankinglists (slug, title, intro_text) 
       VALUES ($1, $2, $3) RETURNING id`,
            [slug, title, introText]
        );
        const listId = listResult.rows[0].id;

        if (items && items.length > 0) {
            for (const item of items) {
                await client.query(
                    `INSERT INTO listitems 
          (list_id, rank, title, subtitle, text_block_1, image_1, text_block_2, image_2) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [listId, item.rank, item.title, item.subtitle, item.textBlock1, item.image1, item.textBlock2, item.image2]
                );
            }
        }

        await client.query("COMMIT");
        return NextResponse.json({ success: true, listId }, { status: 201 });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    } finally {
        client.release();
    }
}