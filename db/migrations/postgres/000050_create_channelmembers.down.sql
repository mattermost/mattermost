CREATE INDEX IF NOT EXISTS idx_channelmembers_channel_id ON channelmembers(channelid);

ALTER TABLE channelmembers DROP COLUMN IF EXISTS schemeguest;

ALTER TABLE channelmembers DROP COLUMN IF EXISTS schemeadmin;
ALTER TABLE channelmembers DROP COLUMN IF EXISTS schemeuser;

DROP INDEX IF EXISTS idx_channelmembers_user_id;

DROP TABLE IF EXISTS channelmembers;
