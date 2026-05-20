CREATE INDEX IF NOT EXISTS idx_sharedchannelusers_user_id ON sharedchannelusers (userid);

ALTER TABLE sharedchannelusers DROP COLUMN IF EXISTS channelid;

DROP TABLE IF EXISTS sharedchannelusers;
