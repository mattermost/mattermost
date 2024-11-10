CREATE TABLE IF NOT EXISTS scheduledposts (
	id VARCHAR(26) PRIMARY KEY,
	createat bigint,
	updateat bigint,
	userid VARCHAR(26) NOT NULL,
	channelid VARCHAR(26) NOT NULL,
	rootid VARCHAR(26),
	message VARCHAR(65535),
	props VARCHAR(8000),
	fileids VARCHAR(300),
	priority text,
	scheduledat bigint NOT NULL,
	processedat bigint,
	errorcode VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_scheduledposts_userid_channel_id_scheduled_at ON ScheduledPosts (UserId, ChannelId, ScheduledAt);
