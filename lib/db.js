const { Pool } = require('pg');

let pool;

// Lazily create a single pooled connection, reused across invocations of the
// same warm serverless instance. Works with any standard Postgres provider
// (Neon via the Vercel Marketplace integration, Supabase, etc.) - Vercel's
// Postgres integrations set DATABASE_URL and/or POSTGRES_URL automatically.
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL (or POSTGRES_URL) environment variable is not set.');
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

module.exports = { getPool };
