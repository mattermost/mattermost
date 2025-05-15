SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Commands'
        AND table_schema = DATABASE()
        AND column_name = 'AutocompleteRequestURL'
    ),
    'SELECT 1;',
    'ALTER TABLE Commands ADD COLUMN AutocompleteRequestURL VARCHAR(1024) NOT NULL DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;