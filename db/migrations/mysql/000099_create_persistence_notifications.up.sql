CREATE TABLE IF NOT EXISTS PersistenceNotifications (
    PostId varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (PostId)
);

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PersistenceNotifications'
        AND table_schema = DATABASE()
        AND index_name = 'idx_persistencenotifications_createat_deleteat'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_persistencenotifications_createat_deleteat ON PersistenceNotifications(CreateAt, DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;