ALTER TABLE users ALTER COLUMN props TYPE jsonb USING props::jsonb;
ALTER TABLE users ALTER COLUMN notifyprops TYPE jsonb USING notifyprops::jsonb;
ALTER TABLE users ALTER COLUMN timezone DROP DEFAULT;
ALTER TABLE users ALTER COLUMN timezone TYPE jsonb USING timezone::jsonb;
