CREATE TABLE IF NOT EXISTS GroupChannels (
    GroupId varchar(26) NOT NULL,
    AutoAdd tinyint(1),
    SchemeAdmin tinyint(1) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    ChannelId varchar(26) NOT NULL,
    PRIMARY KEY (GroupId, ChannelId),
    KEY idx_groupchannels_schemeadmin (SchemeAdmin),
    KEY idx_groupchannels_channelid (ChannelId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'GroupChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_groupchannels_channelid'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_groupchannels_channelid ON GroupChannels (ChannelId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'GroupChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_groupchannels_schemeadmin'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_groupchannels_schemeadmin ON GroupChannels(SchemeAdmin);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'GroupChannels'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeAdmin'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE GroupChannels ADD COLUMN SchemeAdmin tinyint(1);'
));

PREPARE createColumnIfNotExists FROM @preparedStatement;
EXECUTE createColumnIfNotExists;
DEALLOCATE PREPARE createColumnIfNotExists;
