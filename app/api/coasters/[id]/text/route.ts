import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const coasterId = Number(id);

    try {
        const query = `
  SELECT 
    id,
    coaster_id,
    headline,
    text,
    "order"
  FROM coastertext
  WHERE coaster_id = $1
  ORDER BY "order" ASC
`;
        const result = await pool.query(query, [coasterId]);
        return NextResponse.json({ texts: result.rows });
    } catch (error) {
        console.error("Database query error:", error);
        return NextResponse.json(
            { error: "Failed to fetch coaster text" },
            { status: 500 }
        );
    }
}

// POST & UPDATE
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const coasterId = Number(id);

    try {
        const body = await req.json();

        // Reorder array
        if (Array.isArray(body)) {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                for (const entry of body) {
                    await client.query(
                        `UPDATE coastertext SET "order" = $1 WHERE id = $2 AND coaster_id = $3`,
                        [entry.order, entry.id, coasterId]
                    );
                }
                await client.query("COMMIT");
            } catch (err) {
                await client.query("ROLLBACK");
                throw err;
            } finally {
                client.release();
            }
            return NextResponse.json({ success: true });
        }

        const { id: textId, headline, text } = body;
        if (!headline && !text) {
            return NextResponse.json({ error: "Missing headline or text" }, { status: 400 });
        }

        if (textId) {
            // UPDATE existing
            const updateRes = await pool.query(
                `UPDATE coastertext SET headline = $1, text = $2 WHERE id = $3 AND coaster_id = $4 RETURNING *`,
                [headline, text, textId, coasterId]
            );
            return NextResponse.json({ text: updateRes.rows[0] });
        } else {
            // CREATE new
            const maxOrderRes = await pool.query(
                `SELECT COALESCE(MAX("order"), 0) AS max_order FROM coastertext WHERE coaster_id = $1`,
                [coasterId]
            );
            const newOrder = maxOrderRes.rows[0].max_order + 1;

            const insertRes = await pool.query(
                `INSERT INTO coastertext (coaster_id, headline, text, "order") VALUES ($1, $2, $3, $4) RETURNING *`,
                [coasterId, headline, text, newOrder]
            );

            return NextResponse.json({ text: insertRes.rows[0] });
        }
    } catch (error) {
        console.error("Failed to handle coaster text POST:", error);
        return NextResponse.json({ error: "Failed to handle coaster text POST" }, { status: 500 });
    }
}

export async function DELETE(req: Request, context: { params: { id: string } }) {
    const { id } = context.params;
    const coasterId = Number(id);
    const body = await req.json();
    const { textId } = body;

    if (!textId) {
        return NextResponse.json({ error: "Missing textId" }, { status: 400 });
    }

    try {
        await pool.query(
            `DELETE FROM coastertext WHERE id = $1 AND coaster_id = $2`,
            [textId, coasterId]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Failed to delete text" }, { status: 500 });
    }
}
