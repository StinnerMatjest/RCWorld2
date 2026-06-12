import { Pool } from "pg";

// Single shared connection pool for the whole app. Route modules each creating
// their own Pool multiplies idle connections against Postgres' limit.
// Cached on globalThis so Next.js dev hot-reload doesn't leak pools.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

globalForPg.pgPool = pool;
