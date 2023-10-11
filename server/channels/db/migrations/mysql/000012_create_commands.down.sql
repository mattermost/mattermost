SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Commands'
        AND table_schema = DATABASE()
        AND column_name = 'PluginId'
    ) > 0,
    'ALTER TABLE Commands DROP COLUMN PluginId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS Commands;
