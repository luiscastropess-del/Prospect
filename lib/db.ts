import postgres from 'postgres';

let sql: postgres.Sql | null = null;

export async function getDb() {
  if (sql) return sql;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined for Supabase connection.');
  }

  // Initialize postgres client
  sql = postgres(connectionString, {
    ssl: 'require', // Required for Supabase in many environments
    max: 1, // Stay light for e2-micro
    idle_timeout: 20,
    connect_timeout: 30
  });

  // Ensure table exists on initialization
  // Note: DDL in Postgres is slightly different but mostly matches
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS places (
        osm_id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        address TEXT,
        opening_hours TEXT,
        phone TEXT,
        website TEXT,
        photo_url TEXT,
        rating TEXT,
        last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('Supabase table ensured');
  } catch (err) {
    console.error('Failed to initialize Supabase table:', err);
  }

  return sql;
}

// Add compatibility helpers if needed, but search-service.ts uses queries directly.
