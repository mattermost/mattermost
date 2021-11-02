CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

ALTER TABLE users DROP COLUMN IF NOT EXISTS remoteid;

DROP TABLE IF EXISTS users;
