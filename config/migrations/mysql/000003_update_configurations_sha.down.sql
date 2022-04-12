SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Configurations'
        AND table_schema = DATABASE()
        AND index_name = 'idx_configurations_sha'
    ) > 0,
    'DROP INDEX idx_configurations_sha ON Configurations;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Configurations'
        AND table_schema = DATABASE()
        AND column_name = 'SHA'
    ) > 0,
    'ALTER TABLE Configurations DROP COLUMN SHA;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
