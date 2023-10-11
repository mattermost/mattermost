SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserAccessTokens'
        AND table_schema = DATABASE()
        AND index_name = 'idx_user_access_tokens_token'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_user_access_tokens_token ON UserAccessTokens(Token);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

DROP TABLE IF EXISTS UserAccessTokens;
