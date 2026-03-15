-- Add ScheduledRecapId and SkipReason columns to Recaps table
-- These support linking recaps to their scheduled source and tracking skip reasons

ALTER TABLE Recaps ADD COLUMN IF NOT EXISTS ScheduledRecapId VARCHAR(26) DEFAULT '';
ALTER TABLE Recaps ADD COLUMN IF NOT EXISTS SkipReason VARCHAR(64) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_recaps_scheduled_recap_id ON Recaps(ScheduledRecapId);
