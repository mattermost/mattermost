SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Commands'
        AND table_schema = DATABASE()
        AND column_name = 'AutocompleteRequestURL'
    ),
    'ALTER TABLE Commands DROP COLUMN AutocompleteRequestURL;',
    'SELECT 1;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;