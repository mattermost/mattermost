SET lock_timeout = '5s';
DROP TABLE IF EXISTS ChannelMemberLinks;
ALTER TABLE ChannelMembers DROP COLUMN IF EXISTS SourceId;
RESET lock_timeout;
