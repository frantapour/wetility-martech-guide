const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add a Postgres database and reference its DATABASE_URL.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: url,
  ssl: /railway\.internal|localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor','viewer')),
  pw_hash TEXT NOT NULL,
  must_change BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS statuses (
  key TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  by_user INT REFERENCES users(id) ON DELETE SET NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY, sec TEXT NOT NULL, text TEXT NOT NULL,
  by_user INT REFERENCES users(id) ON DELETE SET NULL, at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY, sec TEXT NOT NULL, ref TEXT, date DATE, text TEXT NOT NULL, evidence TEXT,
  by_user INT REFERENCES users(id) ON DELETE SET NULL, at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY, sec TEXT NOT NULL, ref TEXT, title TEXT NOT NULL, detail TEXT,
  severity TEXT NOT NULL DEFAULT 'medium', state TEXT NOT NULL DEFAULT 'open',
  resolution TEXT, by_user INT REFERENCES users(id) ON DELETE SET NULL, at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by INT REFERENCES users(id) ON DELETE SET NULL, resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS results (
  id SERIAL PRIMARY KEY, kpi TEXT NOT NULL, value DOUBLE PRECISION NOT NULL, period TEXT NOT NULL, note TEXT,
  by_user INT REFERENCES users(id) ON DELETE SET NULL, at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS kb (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, system TEXT NOT NULL, pbs JSONB NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '', steps JSONB NOT NULL DEFAULT '[]', practices JSONB NOT NULL DEFAULT '[]',
  changes JSONB NOT NULL DEFAULT '[]', sources JSONB NOT NULL DEFAULT '[]',
  verified_on DATE, verified_by TEXT, review_flag BOOLEAN NOT NULL DEFAULT FALSE, review_note TEXT,
  updated_by INT REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fields (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  measures TEXT NOT NULL DEFAULT '', pii TEXT NOT NULL DEFAULT 'none', owner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'approved', aliases JSONB NOT NULL DEFAULT '[]', expected JSONB NOT NULL DEFAULT '[]',
  merged_into TEXT, updated_by INT REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS impls (
  id SERIAL PRIMARY KEY, field_id TEXT REFERENCES fields(id) ON DELETE SET NULL, system TEXT NOT NULL,
  container TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, name TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
  parent TEXT NOT NULL DEFAULT '', std BOOLEAN NOT NULL DEFAULT FALSE, state TEXT NOT NULL DEFAULT 'planned',
  rename_to TEXT, description TEXT NOT NULL DEFAULT '',
  by_user INT REFERENCES users(id) ON DELETE SET NULL, at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit (
  id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(), by_user INT REFERENCES users(id) ON DELETE SET NULL,
  entity TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, detail JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS assignments (key TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, by_user INT REFERENCES users(id) ON DELETE SET NULL, at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by INT REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
`;

async function init() {
  await pool.query(SCHEMA);
}

module.exports = { pool, init, q: (text, params) => pool.query(text, params) };
