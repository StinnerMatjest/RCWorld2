// app/api/ratings/route.ts
import { Pool } from 'pg';

// Create a new pool instance for PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    console.log("Database URL:", process.env.DATABASE_URL);
    // Query to fetch all ratings from the RATING table
    const result = await pool.query('SELECT * FROM ratings');

    console.log("Query Result:", result.rows); // Log the result to see if data is being returned

    // Send the data as JSON response
    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Database error:', error);
    return new Response('Failed to fetch ratings', { status: 500 });
  }
}
