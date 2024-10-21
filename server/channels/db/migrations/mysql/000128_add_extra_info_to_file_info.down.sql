SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'fileinfo'
        AND table_schema = DATABASE()
        AND column_name = 'extrainfo'
    ) > 0,
    'ALTER TABLE fileinfo DROP COLUMN extrainfo;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
