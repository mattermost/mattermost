CREATE TABLE IF NOT EXISTS PublicChannels (
    Id varchar(26) NOT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    TeamId varchar(26) DEFAULT NULL,
    DisplayName varchar(64) DEFAULT NULL,
    Name varchar(64) DEFAULT NULL,
    Header varchar(1024) DEFAULT NULL,
    Purpose varchar(250) DEFAULT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY Name (Name, TeamId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_team_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_publicchannels_team_id ON PublicChannels(TeamId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_name'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_publicchannels_name ON PublicChannels(name);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_delete_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_publicchannels_delete_at ON PublicChannels(deleteat);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_search_txt'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_publicchannels_search_txt ON PublicChannels(name, displayname, purpose);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

CREATE PROCEDURE MigratePC ()
BEGIN
	IF(NOT EXISTS (
		SELECT
			1 FROM PublicChannels)) THEN
		INSERT INTO PublicChannels (Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
		SELECT
			c.Id, c.DeleteAt, c.TeamId, c.DisplayName, c.Name, c.Header, c.Purpose
		FROM
			Channels c
		LEFT JOIN PublicChannels pc ON (pc.Id = c.Id)
	WHERE
		c.Type = 'O' AND pc.Id IS NULL;
	END IF;
END;

CALL MigratePC();

DROP PROCEDURE IF EXISTS MigratePC;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PublicChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_publicchannels_name'
    ) > 0,
    'DROP INDEX idx_publicchannels_name ON PublicChannels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
