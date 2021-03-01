CREATE TABLE IF NOT EXISTS PluginKeyValueStore (
  PluginId varchar(190) NOT NULL,
  PKey varchar(50) NOT NULL,
  PValue mediumblob,
  PRIMARY KEY (PluginId, PKey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'PluginKeyValueStore'
        AND table_schema = DATABASE()
        AND column_name = 'ExpireAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE PluginKeyValueStore ADD ExpireAt bigint(20) DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT Column_Default FROM Information_Schema.Columns
        WHERE table_name = 'PluginKeyValueStore'
        AND table_schema = DATABASE()
        AND column_name = 'ExpireAt'
    ) = 0,
    'ALTER TABLE PluginKeyValueStore ALTER COLUMN ExpireAt SET DEFAULT NULL;',
    'SELECT 1'
));

PREPARE alterIfDefaultZero FROM @preparedStatement;
EXECUTE alterIfDefaultZero;
DEALLOCATE PREPARE alterIfDefaultZero;
