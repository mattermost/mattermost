CREATE TABLE IF NOT EXISTS GroupTeams (
    GroupId varchar(26) NOT NULL,
    AutoAdd tinyint(1),
    SchemeAdmin tinyint(1) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    TeamId varchar(26) NOT NULL,
    PRIMARY KEY (GroupId, TeamId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'GroupTeams'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeAdmin'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE GroupTeams ADD COLUMN SchemeAdmin tinyint(1) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
     (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'GroupTeams'
        AND table_schema = DATABASE()
        AND index_name = 'idx_groupteams_schemeadmin'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_groupteams_schemeadmin ON GroupTeams(SchemeAdmin);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'GroupTeams'
        AND table_schema = DATABASE()
        AND index_name = 'idx_groupteams_teamid'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_groupteams_teamid ON GroupTeams(TeamId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
