
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'LinkMetadata'
        AND table_schema = DATABASE()
        AND column_name = 'Data'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE LinkMetadata MODIFY COLUMN Data JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
