CREATE TABLE IF NOT EXISTS PublicChannels (
    Id varchar(26) NOT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    TeamId varchar(26) DEFAULT NULL,
    DisplayName varchar(64) DEFAULT NULL,
    Name varchar(64) DEFAULT NULL,
    Header varchar(1024) DEFAULT NULL,
    Purpose varchar(250) DEFAULT NULL,
    PRIMARY KEY (Id),
    UNIQUE KEY Name (Name, TeamId),
    KEY idx_publicchannels_team_id (TeamId),
    KEY idx_publicchannels_name (Name),
    KEY idx_publicchannels_delete_at (DeleteAt),
    KEY idx_publicchannels_search_txt (Name, DisplayName, Purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE PROCEDURE MigratePC()
BEGIN
IF(NOT EXISTS (
		SELECT
			1 FROM PublicChannels)) THEN
    INSERT INTO PublicChannels (Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
    SELECT
    	c.Id,
    	c.DeleteAt,
    	c.TeamId,
    	c.DisplayName,
    	c.Name,
    	c.Header,
    	c.Purpose
    FROM
    	Channels c
    	LEFT JOIN PublicChannels pc ON (pc.Id = c.Id)
    WHERE
    	c.Type = 'O'
    	AND pc.Id IS NULL;
    END IF;
END;

CALL MigratePC();

DROP PROCEDURE IF EXISTS MigratePC;