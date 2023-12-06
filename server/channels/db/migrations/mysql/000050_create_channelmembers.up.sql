CREATE TABLE IF NOT EXISTS ChannelMembers (
    ChannelId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    Roles varchar(64),
    LastViewedAt bigint(20),
    MsgCount bigint(20),
    MentionCount bigint(20),
    NotifyProps text,
    LastUpdateAt bigint(20),
    PRIMARY KEY (ChannelId, UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
        AND column_name = 'SchemeUser'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE ChannelMembers ADD COLUMN SchemeUser tinyint(4);' -- this was tinyint(4) on my instance
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeAdmin'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE ChannelMembers ADD COLUMN SchemeAdmin tinyint(4);' -- this was tinyint(4) on my instance
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeGuest'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE ChannelMembers ADD COLUMN SchemeGuest tinyint(4);' -- this was tinyint(4) on my instance
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channelmembers_channel_id'
    ) > 0,
    'DROP INDEX idx_channelmembers_channel_id ON ChannelMembers;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
