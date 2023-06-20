SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Preferences'
        AND table_schema = DATABASE()
        AND index_name = 'idx_preferences_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_preferences_user_id ON Preferences(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

DROP TABLE IF EXISTS Preferences;
