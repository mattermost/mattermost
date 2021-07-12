CREATE TABLE IF NOT EXISTS UploadSessions (
    Id varchar(26) NOT NULL,
    Type varchar(32) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    ChannelId varchar(26) DEFAULT NULL,
    Filename varchar(256) DEFAULT NULL,
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
