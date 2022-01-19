CREATE TABLE IF NOT EXISTS UploadSessions (
    Id varchar(26) NOT NULL,
    Type varchar(32) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    ChannelId varchar(26) DEFAULT NULL,
    Filename text,
    Path text,
    FileSize bigint(20) DEFAULT NULL,
    FileOffset bigint(20) DEFAULT NULL,
    PRIMARY KEY (Id)
);

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_uploadsessions_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_uploadsessions_user_id ON UploadSessions(UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_uploadsessions_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_uploadsessions_create_at ON UploadSessions(CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_uploadsessions_type'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_uploadsessions_type ON UploadSessions(Type);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND column_name = 'RemoteId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE UploadSessions ADD RemoteId varchar(26) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND column_name = 'ReqFileId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE UploadSessions ADD ReqFileId varchar(26) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

CREATE PROCEDURE Migrate_If_Version_Below_5350 ()
BEGIN
DECLARE
	CURRENT_DB_VERSION TEXT;
	SELECT
		Value
	FROM
		Systems
	WHERE
		Name = 'Version' INTO CURRENT_DB_VERSION;
	IF(INET_ATON(CURRENT_DB_VERSION) < INET_ATON('5.35.0')) THEN
		UPDATE UploadSessions SET RemoteId='', ReqFileId='' WHERE RemoteId IS NULL;
	END IF;
END;
	CALL Migrate_If_Version_Below_5350 ();
	DROP PROCEDURE IF EXISTS Migrate_If_Version_Below_5350;
