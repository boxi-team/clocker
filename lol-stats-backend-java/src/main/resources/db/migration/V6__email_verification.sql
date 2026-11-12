-- ===== V6: create users table with email verification =======================
-- Safe creation in case V5 was already recorded in flyway_schema_history

CREATE TABLE IF NOT EXISTS users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   TEXT UNIQUE,
  password_hash           TEXT,
  display_name            TEXT NOT NULL,
  avatar_url              TEXT,
  auth_provider           TEXT NOT NULL CHECK (auth_provider IN ('email', 'google', 'riot', 'guest')),
  provider_id             TEXT,
  email_verified          BOOLEAN NOT NULL DEFAULT false,
  verification_code       TEXT,
  verification_expires_at TIMESTAMPTZ,
  linked_puuid            TEXT REFERENCES players(puuid) ON DELETE SET NULL,
  linked_region           TEXT,
  linked_riot_id          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist even if users table was partially created
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_linked_puuid_idx ON users (linked_puuid);
CREATE INDEX IF NOT EXISTS users_provider_idx ON users (auth_provider, provider_id);
