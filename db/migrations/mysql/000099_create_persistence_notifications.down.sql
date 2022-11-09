SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PersistenceNotifications'
        AND table_schema = DATABASE()
        AND index_name = 'idx_persistencenotifications_createat_deleteat'
    ) > 0,
    'DROP INDEX idx_persistencenotifications_createat_deleteat ON PersistenceNotifications;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

DROP TABLE IF EXISTS PersistenceNotifications;