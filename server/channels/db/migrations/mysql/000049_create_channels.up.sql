CREATE TABLE IF NOT EXISTS Channels (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20),
    UpdateAt bigint(20),
    DeleteAt bigint(20),
    TeamId varchar(26),
    Type varchar(1),
    DisplayName varchar(64),
    Name varchar(64),
    Header text,
    Purpose varchar(128),
    LastPostAt bigint(20),
    TotalMsgCount bigint(20),
    ExtraUpdateAt bigint(20),
    CreatorId varchar(26),
    PRIMARY KEY (Id),
    UNIQUE KEY Name (Name, TeamId),
    KEY idx_channels_team_id (TeamId),
    KEY idx_channels_name (Name),
    KEY idx_channels_update_at (UpdateAt),
    KEY idx_channels_create_at (CreateAt),
    KEY idx_channels_delete_at (DeleteAt),
    KEY idx_channels_displayname (DisplayName),
    FULLTEXT KEY idx_channels_txt (Name,DisplayName) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT column_type FROM Information_Schema.Columns
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'Purpose'
    ) != 'varchar(250)',
    'ALTER TABLE Channels MODIFY Purpose varchar(250)',
    'SELECT 1'
));

PREPARE alterIfTypeDifferent FROM @preparedStatement;
EXECUTE alterIfTypeDifferent;
DEALLOCATE PREPARE alterIfTypeDifferent;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_displayname'
    ) > 0,
    'DROP INDEX idx_channels_displayname ON Channels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Channels ADD COLUMN SchemeId varchar(26);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_txt'
    ) > 0,
    'DROP INDEX idx_channels_txt ON Channels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'GroupConstrained'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Channels ADD COLUMN GroupConstrained tinyint(4);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT column_type FROM Information_Schema.Columns
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'GroupConstrained'
    ) != 'tinyint(1)',
    'ALTER TABLE Channels MODIFY GroupConstrained tinyint(1)',
    'SELECT 1'
));

PREPARE alterIfTypeDifferent FROM @preparedStatement;
EXECUTE alterIfTypeDifferent;
DEALLOCATE PREPARE alterIfTypeDifferent;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_scheme_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channels_scheme_id ON Channels(SchemeId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channel_search_txt'
    ) > 0,
    'SELECT 1',
    'CREATE FULLTEXT INDEX idx_channel_search_txt ON Channels(Name,DisplayName,Purpose);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'Shared'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Channels ADD COLUMN Shared tinyint(1);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_name'
    ) > 0,
    'DROP INDEX idx_channels_name ON Channels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
