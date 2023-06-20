SET @preparedStatement = (SELECT IF(
    (
        SELECT Column_Default FROM Information_Schema.Columns
        WHERE table_name = 'PluginKeyValueStore'
        AND table_schema = DATABASE()
        AND column_name = 'ExpireAt'
    ) IS NULL,
    'ALTER TABLE PluginKeyValueStore ALTER COLUMN ExpireAt SET DEFAULT 0;',
    'SELECT 1'
));

PREPARE alterIfDefaultNull FROM @preparedStatement;
EXECUTE alterIfDefaultNull;
DEALLOCATE PREPARE alterIfDefaultNull;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'PluginKeyValueStore'
        AND table_schema = DATABASE()
        AND column_name = 'ExpireAt'
    ) > 0,
    'ALTER TABLE PluginKeyValueStore DROP COLUMN ExpireAt;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS PluginKeyValueStore;
