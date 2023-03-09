SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_StatusPosts'
        AND table_schema = DATABASE()
        AND column_name = 'Status'
    ),
    'ALTER TABLE IR_StatusPosts ADD COLUMN Status VARCHAR(1024) NOT NULL DEFAULT "";',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;
