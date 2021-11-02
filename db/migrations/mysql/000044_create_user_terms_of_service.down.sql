SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserTermsOfService'
        AND table_schema = DATABASE()
        AND index_name = 'idx_user_terms_of_service_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_user_terms_of_service_user_id ON UserTermsOfService(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

DROP TABLE IF EXISTS UserTermsOfService;
