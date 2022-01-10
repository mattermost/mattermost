SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'SharedChannelUsers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sharedchannelusers_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_sharedchannelusers_user_id ON SharedChannelUsers(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelUsers'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ) > 0,
    'ALTER TABLE SharedChannelUsers DROP COLUMN ChannelId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS SharedChannelUsers;
