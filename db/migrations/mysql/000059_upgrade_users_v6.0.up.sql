SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Props'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Users MODIFY COLUMN Props JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'NotifyProps'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Users MODIFY COLUMN NotifyProps JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Timezone'
        AND column_default IS NOT NULL
    ) > 0,
    'ALTER TABLE Users ALTER Timezone DROP DEFAULT;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Timezone'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Users MODIFY COLUMN Timezone JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Roles'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE Users MODIFY COLUMN Roles text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
