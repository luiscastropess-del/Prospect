import postgres from 'postgres';

let sql: postgres.Sql | null = null;

export async function getDb() {
  if (sql) return sql;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada nos Secrets/Ambiente');
  }

  sql = postgres(connectionString, {
    ssl: 'require',
    max: 1 // Limite de conexão para e2-micro
  });

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
  } catch (err) {
    console.error('Erro ao inicializar tabela Supabase:', err);
  }

  return sql;
}
