-- Remove BotID column from Recaps table
DROP INDEX IF EXISTS idx_recaps_bot_id;
ALTER TABLE Recaps DROP COLUMN IF EXISTS BotID;

