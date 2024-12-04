SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UserAccessTokens'
        AND table_schema = DATABASE()
        AND column_name = 'ExpiresAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE UserAccessTokens ADD COLUMN ExpiresAt bigint DEFAULT NULL'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
