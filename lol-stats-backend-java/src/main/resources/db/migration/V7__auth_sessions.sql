-- Login sessions for email accounts. Only the SHA-256 hash of a token is stored, never the token itself.
CREATE TABLE IF NOT EXISTS auth_sessions (
                                             token_hash  TEXT PRIMARY KEY,
                                             user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
    );

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);

-- Wrong verification codes entered since the last code was sent; the code is dropped after too many.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts INT NOT NULL DEFAULT 0;

