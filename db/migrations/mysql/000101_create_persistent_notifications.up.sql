CREATE TABLE IF NOT EXISTS PersistentNotifications (
    PostId varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    LastSentAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    SentCount smallint DEFAULT NULL,
    PRIMARY KEY (PostId)
);

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PersistentNotifications'
        AND table_schema = DATABASE()
        AND index_name = 'idx_persistentnotifications_createat_deleteat'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_persistentnotifications_createat_deleteat ON PersistentNotifications(CreateAt, DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;