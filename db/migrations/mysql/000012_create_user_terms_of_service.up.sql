CREATE TABLE IF NOT EXISTS UserTermsOfService (
    UserId varchar(26) NOT NULL,
    TermsOfServiceId varchar(26) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

INSERT INTO UserTermsOfService
    SELECT Id, AcceptedTermsOfServiceId as TermsOfServiceId, ROUND(UNIX_TIMESTAMP(CURTIME(4)) * 1000)
    FROM Users
    WHERE AcceptedTermsOfServiceId != ''
    AND AcceptedTermsOfServiceId IS NOT NULL;
