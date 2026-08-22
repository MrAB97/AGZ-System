-- AGZ Game Zone - Database Schema (Postgres)
--
-- Run this once against your Vercel/Neon Postgres database (e.g. via
-- `psql "$DATABASE_URL" -f schema.postgres.sql`, or paste it into the
-- Neon/Vercel SQL editor) to create the tables.
--
-- Design note: each table stores one JSON "blob" per record (id + data).
-- This mirrors the JS objects the app already works with exactly, so the
-- frontend needs almost no rewriting to talk to this backend - it just
-- sends/receives the same JSON arrays it used to save to localStorage.
-- If you later want SQL-level reporting (e.g. "total revenue this month"),
-- these can be normalized into real columns - this version optimizes for
-- getting a working backend quickly.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS prices (
    id VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media (
    id VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournaments (
    id VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
    id VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['prices', 'media', 'tournaments', 'customers', 'stations', 'sales']
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
            tbl, tbl
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- No default admin account is created here (a plaintext password in a SQL
-- file would sit in your project folder forever). Call POST /api/setup once
-- (see api/setup.js) after creating this schema - it creates the first admin
-- account properly hashed, then remove the SETUP_TOKEN env var.

-- Tables start empty - the app will automatically seed them with the built-in
-- default demo data the first time it loads and finds the database empty.
-- (The "sales" table is the exception - it's a running transaction log and is
-- never auto-seeded, so it stays empty until real sales happen.)
