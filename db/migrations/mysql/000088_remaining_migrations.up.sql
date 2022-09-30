DROP TABLE IF EXISTS JobStatuses;

DROP TABLE IF EXISTS PasswordRecovery;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'ThemeProps'
    ) > 0,
    'INSERT INTO Preferences(UserId, Category, Name, Value) SELECT Id, \'\', \'\', ThemeProps FROM Users WHERE Users.ThemeProps != \'null\'',
    'SELECT 1'
));

PREPARE migrateTheme FROM @preparedStatement;
EXECUTE migrateTheme;
DEALLOCATE PREPARE migrateTheme;

-- We have to do this twice because the prepared statement doesn't support multiple SQL queries
-- in a single string.

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'ThemeProps'
    ) > 0,
    'ALTER TABLE Users DROP COLUMN ThemeProps',
    'SELECT 1'
));

PREPARE migrateTheme FROM @preparedStatement;
EXECUTE migrateTheme;
DEALLOCATE PREPARE migrateTheme;
