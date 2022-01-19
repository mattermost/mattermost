CREATE TABLE IF NOT EXISTS UserTermsOfService (
    UserId varchar(26) NOT NULL,
    TermsOfServiceId varchar(26) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE PROCEDURE MigrateToUserTermsOfServiceTable()
BEGIN
	DECLARE COL_EXIST INT;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'AcceptedTermsOfServiceId' INTO COL_EXIST;

	IF(COL_EXIST > 0) THEN
		INSERT INTO UserTermsOfService
        	SELECT Id, AcceptedTermsOfServiceId as TermsOfServiceId, ROUND(UNIX_TIMESTAMP(CURTIME(4)) * 1000)
        	FROM Users
        	WHERE AcceptedTermsOfServiceId != ''
        	AND AcceptedTermsOfServiceId IS NOT NULL;
	END IF;
END;

CALL MigrateToUserTermsOfServiceTable();

DROP PROCEDURE IF EXISTS MigrateToUserTermsOfServiceTable;

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
