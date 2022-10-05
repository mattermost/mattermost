CREATE TABLE IF NOT EXISTS Emoji (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    CreatorId varchar(26) DEFAULT NULL,
    Name varchar(64) DEFAULT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY (Name, DeleteAt),
    KEY idx_emoji_update_at (UpdateAt),
    KEY idx_emoji_create_at (CreateAt),
    KEY idx_emoji_delete_at (DeleteAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.statistics
        WHERE table_name = 'Emoji'
        AND table_schema = DATABASE()
        AND index_name = 'idx_emoji_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX ON Emoji(CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.statistics
        WHERE table_name = 'Emoji'
        AND table_schema = DATABASE()
        AND index_name = 'idx_emoji_delete_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX ON Emoji(DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.statistics
        WHERE table_name = 'Emoji'
        AND table_schema = DATABASE()
        AND index_name = 'idx_emoji_update_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX ON Emoji(UpdateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Emoji'
        AND table_schema = DATABASE()
        AND index_name = 'idx_emoji_name'
    ) > 0,
    'DROP INDEX idx_emoji_name ON Emoji;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
