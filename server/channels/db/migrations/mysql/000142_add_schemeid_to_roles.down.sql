SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Roles'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeId'
    ) > 0,
    'ALTER TABLE Roles DROP COLUMN SchemeId;',
    'SELECT 1'
));

PREPARE dropColumnIfExists FROM @preparedStatement;
EXECUTE dropColumnIfExists;
DEALLOCATE PREPARE dropColumnIfExists;
