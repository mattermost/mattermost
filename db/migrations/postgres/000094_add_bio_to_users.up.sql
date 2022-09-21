ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(320) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_users_bio_txt ON users USING gin(to_tsvector('english', bio));
