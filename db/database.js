const { Pool } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Neon's serverless driver is API-compatible with `pg` but reaches the database
// over HTTPS/WebSocket on 443 instead of the Postgres port.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Same three tables as the SQLite version. Timestamps stay TEXT: they are already
// stored and read that way, and switching to TIMESTAMPTZ would add timezone
// questions on top of the migration.
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id TEXT NOT NULL,
      clock_in_time TEXT,
      clock_out_time TEXT,
      date TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS device (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      device_token TEXT,
      registered_at TEXT
    )
  `);
}

module.exports = { pool, initSchema };
