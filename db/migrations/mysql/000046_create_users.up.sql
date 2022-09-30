CREATE TABLE IF NOT EXISTS Users (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    Username varchar(64) DEFAULT NULL,
    Password varchar(128) DEFAULT NULL,
    AuthData varchar(128) DEFAULT NULL,
    AuthService varchar(32) DEFAULT NULL,
    Email varchar(128) DEFAULT NULL,
    EmailVerified tinyint(1),
    Nickname varchar(64) DEFAULT NULL,
    FirstName varchar(64) DEFAULT NULL,
    LastName varchar(64) DEFAULT NULL,
    Roles varchar(256) DEFAULT NULL,
    AllowMarketing tinyint(1),
    Props text,
    NotifyProps text,
    LastPasswordUpdate bigint(20) DEFAULT NULL,
    LastPictureUpdate bigint(20) DEFAULT NULL,
    FailedAttempts integer,
    Locale varchar(5) DEFAULT NULL,
    MfaActive tinyint(1),
    MfaSecret varchar(128) DEFAULT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY Username (Username),
    UNIQUE KEY AuthData (AuthData),
    UNIQUE KEY Email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'LastActivityAt'
    ) > 0,
    'ALTER TABLE Users DROP COLUMN LastActivityAt;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'LastPingAt'
    ) > 0,
    'ALTER TABLE Users DROP COLUMN LastPingAt;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

CREATE PROCEDURE Migrate_If_Version_Below_350 ()
BEGIN
DECLARE
	CURRENT_DB_VERSION TEXT;
	SELECT
		Value
	FROM
		Systems
	WHERE
		Name = 'Version' INTO CURRENT_DB_VERSION;
	IF(INET_ATON(CURRENT_DB_VERSION) < INET_ATON('3.5.0')) THEN		
        UPDATE Users SET Roles = 'system_user' WHERE Roles = '';
        UPDATE Users SET Roles = 'system_user system_admin' WHERE Roles = 'system_admin';
	END IF;
END;
	CALL Migrate_If_Version_Below_350 ();
	DROP PROCEDURE IF EXISTS Migrate_If_Version_Below_350;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Position'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Users ADD Position varchar(128) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Timezone'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Users ADD Timezone varchar(256) DEFAULT \'{"automaticTimezone":"","manualTimezone":"","useAutomaticTimezone":"true"}\';'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Position'
    ) > 0,
    'ALTER TABLE Users MODIFY Position varchar(128);',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

CREATE PROCEDURE Migrate_If_Version_Below_4100 ()
BEGIN
DECLARE
	CURRENT_DB_VERSION TEXT;
	SELECT
		Value
	FROM
		Systems
	WHERE
		Name = 'Version' INTO CURRENT_DB_VERSION;
	IF(INET_ATON(CURRENT_DB_VERSION) < INET_ATON('4.10.0')) THEN
		UPDATE Users SET AuthData=LOWER(AuthData) WHERE AuthService = 'saml';
	END IF;
END;
	CALL Migrate_If_Version_Below_4100 ();
	DROP PROCEDURE IF EXISTS Migrate_If_Version_Below_4100;

SET @preparedStatement = (SELECT IF(
    (
        SELECT MIN(CHAR_LENGTH(Roles)) - MAX(CHAR_LENGTH(Roles))
        FROM Users
    ) != 0,
    'ALTER TABLE Users MODIFY Roles varchar(256);',
    'SELECT 1'
));

PREPARE updateIfMismatch FROM @preparedStatement;
EXECUTE updateIfMismatch;
DEALLOCATE PREPARE updateIfMismatch;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_update_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_users_update_at ON Users(UpdateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_users_create_at ON Users(CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_delete_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_users_delete_at ON Users(DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_all_txt'
    ) > 0,
    'SELECT 1',
    'CREATE FULLTEXT INDEX idx_users_all_txt ON Users(Username, FirstName, LastName, Nickname, Email);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_all_no_full_name_txt'
    ) > 0,
    'SELECT 1',
    'CREATE FULLTEXT INDEX idx_users_all_no_full_name_txt ON Users(Username, Nickname, Email);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_names_txt'
    ) > 0,
    'SELECT 1',
    'CREATE FULLTEXT INDEX idx_users_names_txt ON Users(Username, FirstName, LastName, Nickname);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_names_no_full_name_txt'
    ) > 0,
    'SELECT 1',
    'CREATE FULLTEXT INDEX idx_users_names_no_full_name_txt ON Users(Username, Nickname);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Users ADD RemoteId VARCHAR(26);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND index_name = 'idx_users_email'
    ) > 0,
    'DROP INDEX idx_users_email ON Users;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
