ALTER TABLE reactions drop column channelid;
DROP INDEX IF EXISTS idx_reactions_channel_id;
