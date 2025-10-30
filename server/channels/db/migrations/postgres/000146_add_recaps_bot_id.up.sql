-- Add BotID column to Recaps table to track which AI agent was used
ALTER TABLE Recaps ADD COLUMN IF NOT EXISTS BotID VARCHAR(26) DEFAULT '' NOT NULL;

-- Add index for filtering/searching by bot
CREATE INDEX IF NOT EXISTS idx_recaps_bot_id ON Recaps(BotID);

