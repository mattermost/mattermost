DROP TABLE IF EXISTS scheduledposts;

SET @preparedStatement = (SELECT IF(
	 (
		 SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		 WHERE table_name = 'ScheduledPosts'
		   AND table_schema = DATABASE()
		   AND index_name = 'idx_scheduledposts_userid_channel_id_scheduled_at'
	 ) > 0,
	 'DROP INDEX idx_scheduledposts_userid_channel_id_scheduled_at on ScheduledPosts;',
	 'SELECT 1;'
 ));
PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
