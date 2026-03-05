-- Remove ScheduledRecapId and SkipReason columns from Recaps table
DROP INDEX IF EXISTS idx_recaps_scheduled_recap_id;
ALTER TABLE Recaps DROP COLUMN IF EXISTS SkipReason;
ALTER TABLE Recaps DROP COLUMN IF EXISTS ScheduledRecapId;
