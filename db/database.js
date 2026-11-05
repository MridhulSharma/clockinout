const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'clock.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    clock_in_time TEXT,
    clock_out_time TEXT,
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS device (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    device_token TEXT,
    registered_at TEXT
  );
`);

module.exports = db;
