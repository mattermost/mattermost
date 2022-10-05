CREATE TABLE IF NOT EXISTS Sessions (
    Id varchar(26) PRIMARY KEY,
    Token varchar(26) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    ExpiresAt bigint(20) DEFAULT NULL,
    LastActivityAt bigint(20) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    DeviceId text,
    Roles varchar(64) DEFAULT NULL,
    IsOAuth tinyint(1),
    Props text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND column_name = 'ExpiredNotify'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Sessions ADD ExpiredNotify tinyint(1) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sessions_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_sessions_user_id ON Sessions(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sessions_token'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_sessions_token ON Sessions(Token);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sessions_expires_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_sessions_expires_at ON Sessions(ExpiresAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sessions_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_sessions_create_at ON Sessions(CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sessions_last_activity_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_sessions_last_activity_at ON Sessions(LastActivityAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

CREATE PROCEDURE Migrate_If_Version_Below_5120 ()
BEGIN
DECLARE
	CURRENT_DB_VERSION TEXT;
	SELECT
		Value
	FROM
		Systems
	WHERE
		Name = 'Version' INTO CURRENT_DB_VERSION;
	IF(INET_ATON(CURRENT_DB_VERSION) < INET_ATON('5.12.0')) THEN
		DELETE FROM Sessions where ExpiresAt > 3000000000000;
	END IF;
END;
	CALL Migrate_If_Version_Below_5120 ();
	DROP PROCEDURE IF EXISTS Migrate_If_Version_Below_5120;
