SET @preparedStatement = (SELECT IF(
    (
        SELECT Count(*) FROM Information_Schema.Columns
        WHERE table_name = 'PluginKeyValueStore'
        AND table_schema = DATABASE()
        AND column_name = 'PKey'
        AND column_type != 'varchar(50)'
    ) > 0,
    'ALTER TABLE PluginKeyValueStore MODIFY COLUMN PKey varchar(50);',
    'SELECT 1'
));

PREPARE alterTypeIfExists FROM @preparedStatement;
EXECUTE alterTypeIfExists;
DEALLOCATE PREPARE alterTypeIfExists;
