SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND column_name = 'Roles'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE Sessions MODIFY COLUMN Roles text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
