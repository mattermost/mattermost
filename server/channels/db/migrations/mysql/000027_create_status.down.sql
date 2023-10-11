SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND index_name = 'idx_status_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_status_user_id ON Status(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

DROP TABLE IF EXISTS Status;
