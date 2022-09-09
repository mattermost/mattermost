CREATE TABLE IF NOT EXISTS Preferences (
    UserId varchar(26) NOT NULL,
    Category varchar(32) NOT NULL,
    Name varchar(32) NOT NULL,
    Value text,
    PRIMARY KEY (UserId, Category, Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Preferences'
        AND table_schema = DATABASE()
        AND column_name = 'Value'
        AND data_type != 'text'
    ) > 0,
    'ALTER TABLE Preferences MODIFY Value text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Preferences'
        AND table_schema = DATABASE()
        AND index_name = 'idx_preferences_category'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_preferences_category ON Preferences(Category);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Preferences'
        AND table_schema = DATABASE()
        AND index_name = 'idx_preferences_name'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_preferences_name ON Preferences(Name);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

CREATE PROCEDURE RenameSolarizedThemeWithUnderscore()
BEGIN
    DECLARE finished INTEGER DEFAULT 0;
    DECLARE curUserId VARCHAR(26);
    DECLARE curName VARCHAR(32);
    DECLARE curValue text;

    DECLARE preference
        CURSOR FOR
            SELECT UserId, Name, Value
            FROM Preferences
            WHERE Category = 'theme' AND Value LIKE '%solarized_%';

    -- declare NOT FOUND handler
    DECLARE CONTINUE HANDLER
    FOR NOT FOUND SET finished = 1;

    OPEN preference;

    getPreference: LOOP
        FETCH preference INTO curUserId, curName, curValue;
        IF finished = 1 THEN
            LEAVE getPreference;
        END IF;

        -- update affected rows
        UPDATE Preferences
        SET Value = replace(curValue, 'solaraized_', 'solarized-')
        WHERE Category = 'theme'
        AND UserId = curUserId
        AND Name = curName;
    END LOOP getPreference;
END;

CALL RenameSolarizedThemeWithUnderscore();

DROP PROCEDURE IF EXISTS RenameSolarizedThemeWithUnderscore;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Preferences'
        AND table_schema = DATABASE()
        AND index_name = 'idx_preferences_user_id'
    ) > 0,
    'DROP INDEX idx_preferences_user_id ON Preferences;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
