SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND column_name = 'PinAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Posts ADD COLUMN PinAt bigint(20);'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
