SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserTermsOfService'
        AND table_schema = DATABASE()
        AND index_name = 'idx_user_terms_of_service_user_id'
    ) > 0,
    'DROP INDEX idx_user_terms_of_service_user_id ON UserTermsOfService;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

DROP TABLE IF EXISTS UserTermsOfService;
