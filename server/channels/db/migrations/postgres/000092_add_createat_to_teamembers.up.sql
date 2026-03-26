ALTER TABLE teammembers ADD COLUMN IF NOT EXISTS createat bigint DEFAULT 0;
-- nolint:concurrentIndex
CREATE INDEX IF NOT EXISTS idx_teammembers_createat on teammembers (createat);
