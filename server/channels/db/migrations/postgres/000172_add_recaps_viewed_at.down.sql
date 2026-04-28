DROP INDEX IF EXISTS idx_recaps_user_id_viewed_at;
ALTER TABLE Recaps DROP COLUMN IF EXISTS ViewedAt;
