SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ScheduledPosts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_scheduledposts_userid_channel_id_scheduled_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_scheduledposts_userid_channel_id_scheduled_at ON ScheduledPosts (UserId, ChannelId, ScheduledAt DESC);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ScheduledPosts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_scheduledposts_scheduledat_id_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_scheduledposts_scheduledat_id_id ON ScheduledPosts (ScheduledAt desc, Id);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ScheduledPosts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_scheduledposts_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_scheduledposts_id ON ScheduledPosts (Id);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
