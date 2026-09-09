-- Remove ScheduledRecapId and SkipReason columns from Recaps table
ALTER TABLE Recaps DROP COLUMN IF EXISTS SkipReason;
ALTER TABLE Recaps DROP COLUMN IF EXISTS ScheduledRecapId;
