-- Add ReadAt column to Recaps table
ALTER TABLE Recaps ADD COLUMN IF NOT EXISTS ReadAt BIGINT DEFAULT 0 NOT NULL;

-- Add index for filtering by read status
CREATE INDEX IF NOT EXISTS idx_recaps_user_id_read_at ON Recaps(UserId, ReadAt);

