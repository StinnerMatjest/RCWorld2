import { Pool } from "pg";
import { NextResponse } from "next/server";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Fetch all currently disabled categories
export async function GET() {
    try {
        const query = `SELECT category_id FROM disabled_connections_categories;`;
        const result = await pool.query(query);

        // Flatten the result into a simple array of strings: ["bobsled", "long-names"]
        const disabledCategories = result.rows.map(row => row.category_id);

        return NextResponse.json({ disabledCategories }, { status: 200 });
    } catch (error) {
        console.error("Database query error (GET categories):", error);
        return NextResponse.json({ error: "Failed to fetch disabled categories" }, { status: 500 });
    }
}

// Disable a category (Add to table)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { categoryId, categoryIds } = body;

        // --- NEW: BULK INSERT ---
        if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
            // Creates a string like "($1), ($2), ($3)"
            const values = categoryIds.map((_, index) => `($${index + 1})`).join(", ");
            const query = `
        INSERT INTO disabled_connections_categories (category_id) 
        VALUES ${values} 
        ON CONFLICT (category_id) DO NOTHING;
      `;
            await pool.query(query, categoryIds);
            return NextResponse.json({ success: true, message: "Categories disabled" }, { status: 200 });
        }

        // --- EXISTING: SINGLE INSERT ---
        if (!categoryId) {
            return NextResponse.json({ error: "categoryId or categoryIds is required" }, { status: 400 });
        }

        const query = `
      INSERT INTO disabled_connections_categories (category_id) 
      VALUES ($1) 
      ON CONFLICT (category_id) DO NOTHING;
    `;
        await pool.query(query, [categoryId]);

        return NextResponse.json({ success: true, message: "Category disabled" }, { status: 200 });
    } catch (error) {
        console.error("Database query error (POST category):", error);
        return NextResponse.json({ error: "Failed to disable category" }, { status: 500 });
    }
}

// Enable a category (Remove from table)
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { categoryId, categoryIds } = body;

        // --- NEW: BULK DELETE ---
        if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
            // Creates a string like "$1, $2, $3"
            const placeholders = categoryIds.map((_, index) => `$${index + 1}`).join(", ");
            const query = `DELETE FROM disabled_connections_categories WHERE category_id IN (${placeholders});`;
            await pool.query(query, categoryIds);
            return NextResponse.json({ success: true, message: "Categories enabled" }, { status: 200 });
        }

        // --- EXISTING: SINGLE DELETE ---
        if (!categoryId) {
            return NextResponse.json({ error: "categoryId or categoryIds is required" }, { status: 400 });
        }

        const query = `DELETE FROM disabled_connections_categories WHERE category_id = $1;`;
        await pool.query(query, [categoryId]);

        return NextResponse.json({ success: true, message: "Category enabled" }, { status: 200 });
    } catch (error) {
        console.error("Database query error (DELETE category):", error);
        return NextResponse.json({ error: "Failed to enable category" }, { status: 500 });
    }
}