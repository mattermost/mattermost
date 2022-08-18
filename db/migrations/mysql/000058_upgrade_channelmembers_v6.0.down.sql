
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channelmembers_channel_id_scheme_guest_user_id'
    ) > 0,
    'DROP INDEX idx_channelmembers_channel_id_scheme_guest_user_id ON ChannelMembers;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;


SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channelmembers_user_id_channel_id_last_viewed_at'
    ) > 0,
    'DROP INDEX idx_channelmembers_user_id_channel_id_last_viewed_at ON ChannelMembers;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channelmembers_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channelmembers_user_id ON ChannelMembers(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'NotifyProps'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE ChannelMembers MODIFY COLUMN NotifyProps text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
