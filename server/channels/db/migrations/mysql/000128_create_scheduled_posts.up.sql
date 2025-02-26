CREATE TABLE IF NOT EXISTS ScheduledPosts (
	id VARCHAR(26) PRIMARY KEY,
	createat bigint(20),
	updateat bigint(20),
	userid VARCHAR(26) NOT NULL,
	channelid VARCHAR(26) NOT NULL,
	rootid VARCHAR(26),
	message text,
	props text,
	fileids text,
	priority text,
	scheduledat bigint(20) NOT NULL,
	processedat bigint(20),
	errorcode VARCHAR(200)
);

SET @preparedStatement = (SELECT IF(
	 (
		 SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		 WHERE table_name = 'ScheduledPosts'
		   AND table_schema = DATABASE()
		   AND index_name = 'idx_scheduledposts_userid_channel_id_scheduled_at'
	 ) > 0,
	 'SELECT 1',
	 'CREATE INDEX idx_scheduledposts_userid_channel_id_scheduled_at ON ScheduledPosts (UserId, ChannelId, ScheduledAt);'
 ));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
