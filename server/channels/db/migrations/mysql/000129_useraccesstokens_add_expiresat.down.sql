SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UserAccessTokens'
        AND table_schema = DATABASE()
        AND column_name = 'ExpiresAt'
    ) > 0,
    'ALTER TABLE UserAccessTokens DROP COLUMN ExpiresAt',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
