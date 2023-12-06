SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND index_name = 'idx_status_status_dndendtime'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_status_status_dndendtime ON Status(Status, DNDEndTime);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND index_name = 'idx_status_status'
    ) > 0,
    'DROP INDEX idx_status_status ON Status;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
