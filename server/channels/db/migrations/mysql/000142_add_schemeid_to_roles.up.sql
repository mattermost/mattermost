SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Roles'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Roles ADD COLUMN SchemeId varchar(26);'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;
