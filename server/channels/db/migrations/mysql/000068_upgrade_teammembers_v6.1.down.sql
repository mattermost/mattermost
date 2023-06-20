SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND column_name = 'Roles'
        AND column_type != 'varchar(64)'
    ) > 0,
    'ALTER TABLE TeamMembers MODIFY COLUMN Roles varchar(64);',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
