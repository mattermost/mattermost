ALTER TABLE teammembers ADD COLUMN IF NOT EXISTS createat bigint DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_teammembers_createat on teammembers (createat);
