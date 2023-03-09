SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_StatusPosts'
        AND table_schema = DATABASE()
        AND column_name = 'Status'
    ),
    'ALTER TABLE IR_StatusPosts DROP COLUMN Status;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;
