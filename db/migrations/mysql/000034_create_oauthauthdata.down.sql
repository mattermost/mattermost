SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'OAuthAuthData'
        AND table_schema = DATABASE()
        AND index_name = 'idx_oauthauthdata_client_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_oauthauthdata_client_id ON OAuthAuthData(Code);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

DROP TABLE IF EXISTS OAuthAuthData;
