SET lock_timeout = '5s';
DROP TABLE IF EXISTS WikiLinks;
ALTER TABLE ChannelMembers DROP COLUMN IF EXISTS SourceId;
RESET lock_timeout;
