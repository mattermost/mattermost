-- Remove ReadAt column from Recaps table
DROP INDEX IF EXISTS idx_recaps_user_id_read_at;
ALTER TABLE Recaps DROP COLUMN IF EXISTS ReadAt;

