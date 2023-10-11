SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_email'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_users_email ON Users(Email);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'ALTER TABLE Users DROP RemoteId;',
    'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

DROP TABLE IF EXISTS Users;
