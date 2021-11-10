CREATE TABLE IF NOT EXISTS ThreadMemberships (
    PostId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    Following tinyint(1),
    LastViewed bigint(20) DEFAULT NULL,
    LastUpdated bigint(20) DEFAULT NULL,
    PRIMARY KEY (PostId, UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND column_name = 'UnreadMentions'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE ThreadMemberships ADD UnreadMentions bigint(20) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND index_name = 'idx_thread_memberships_last_update_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_thread_memberships_last_update_at ON ThreadMemberships(LastUpdated);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND index_name = 'idx_thread_memberships_last_view_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_thread_memberships_last_view_at ON ThreadMemberships(LastViewed);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND index_name = 'idx_thread_memberships_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_thread_memberships_user_id ON ThreadMemberships(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
