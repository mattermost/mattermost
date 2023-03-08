SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND column_name = 'PinBy'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Posts ADD COLUMN PinBy VARCHAR(26);'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
