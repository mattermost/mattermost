ALTER TABLE sessions ALTER COLUMN props TYPE jsonb USING props::jsonb;
