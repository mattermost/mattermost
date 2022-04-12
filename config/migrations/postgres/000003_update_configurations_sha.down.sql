DROP INDEX IF EXISTS idx_configurations_sha;

ALTER TABLE Configurations DROP COLUMN IF EXISTS SHA;
