SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'NotifyAdmin'
        AND table_schema = DATABASE()
        AND column_name = 'SentAt'
    ),
    'ALTER TABLE NotifyAdmin ADD COLUMN SentAt bigint;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;
