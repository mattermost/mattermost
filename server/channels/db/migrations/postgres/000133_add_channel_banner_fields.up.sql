ALTER TABLE channels ADD COLUMN IF NOT EXISTS channelbannerenabled boolean;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS channelbannertext text;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS channelbannercolor VARCHAR(100);
