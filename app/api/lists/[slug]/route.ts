import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await context.params;

        const listResult = await pool.query(
            `SELECT id, slug, title, intro_text 
       FROM rankinglists
       WHERE slug = $1`,
            [slug]
        );

        if (listResult.rowCount === 0) {
            return NextResponse.json({ error: "Ranking list not found" }, { status: 404 });
        }

        const list = listResult.rows[0];

        const itemsResult = await pool.query(
            `SELECT id, rank, title, subtitle, text_block_1, image_1, text_block_2, image_2 
       FROM listitems 
       WHERE list_id = $1 
       ORDER BY rank ASC`,
            [list.id]
        );

        const rankingList = {
            id: list.id,
            slug: list.slug,
            title: list.title,
            introText: list.intro_text,
            items: itemsResult.rows.map((row) => ({
                id: row.id,
                rank: row.rank,
                title: row.title,
                subtitle: row.subtitle,
                textBlock1: row.text_block_1,
                image1: row.image_1,
                textBlock2: row.text_block_2,
                image2: row.image_2,
            })),
        };

        return NextResponse.json({ rankingList }, { status: 200 });
    } catch (error) {
        console.error("DB error:", error);
        return NextResponse.json(
            { error: "Failed to fetch ranking list" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    const client = await pool.connect();
    try {
        const { slug: oldSlug } = await context.params;
        const body = await req.json();
        const { title, slug: newSlug, introText, items } = body;

        await client.query("BEGIN");

        // Update the main list info
        const listResult = await client.query(
            `UPDATE rankinglists 
       SET title = $1, slug = $2, intro_text = $3 
       WHERE slug = $4 RETURNING id`,
            [title, newSlug, introText, oldSlug]
        );

        if (listResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: "List not found" }, { status: 404 });
        }

        const listId = listResult.rows[0].id;

        // Delete old items and insert new ones
        await client.query(`DELETE FROM listitems WHERE list_id = $1`, [listId]);

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
        return NextResponse.json({ success: true, newSlug }, { status: 200 });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Update error:", error);
        return NextResponse.json({ error: "Failed to update list" }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await context.params;
        await pool.query("DELETE FROM rankinglists WHERE slug = $1", [slug]);
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Delete error:", error);
        return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
    }
}