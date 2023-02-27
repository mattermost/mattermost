CREATE TABLE IF NOT EXISTS UserGroups (
    Id varchar(26) NOT NULL,
    Name varchar(64) DEFAULT NULL,
    DisplayName varchar(128) DEFAULT NULL,
    Description text,
    Source varchar(64) DEFAULT NULL,
    RemoteId varchar(48) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    AllowReference tinyint(1) DEFAULT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY Name (Name),
    UNIQUE KEY Source (Source, RemoteId),
    KEY idx_usergroups_remote_id (RemoteId),
    KEY idx_usergroups_delete_at (DeleteAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UserGroups'
        AND table_schema = DATABASE()
        AND column_name = 'AllowReference'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE UserGroups ADD AllowReference tinyint(1) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserGroups'
        AND table_schema = DATABASE()
        AND index_name = 'idx_usergroups_remote_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_usergroups_remote_id ON UserGroups(RemoteId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserGroups'
        AND table_schema = DATABASE()
        AND index_name = 'idx_usergroups_delete_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_usergroups_delete_at ON UserGroups(DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
