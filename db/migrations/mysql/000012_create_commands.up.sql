CREATE TABLE IF NOT EXISTS Commands (
    Id varchar(26) NOT NULL,
    Token varchar(26) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    DeleteAt bigint(20) DEFAULT NULL,
    CreatorId varchar(26) DEFAULT NULL,
    TeamId varchar(26) DEFAULT NULL,
    `Trigger` varchar(128) DEFAULT NULL,
    Method varchar(1) DEFAULT NULL,
    Username varchar(64) DEFAULT NULL,
    IconURL text,
    AutoComplete tinyint(1) DEFAULT NULL,
    AutoCompleteDesc text,
    AutoCompleteHint text,
    DisplayName varchar(64) DEFAULT NULL,
    Description varchar(128) DEFAULT NULL,
    URL text,
    PRIMARY KEY (Id),
    KEY idx_command_team_id (TeamId),
    KEY idx_command_update_at (UpdateAt),
    KEY idx_command_create_at (CreateAt),
    KEY idx_command_delete_at (DeleteAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Commands'
        AND table_schema = DATABASE()
        AND column_name = 'PluginId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Commands ADD PluginId varchar(190);'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

CREATE PROCEDURE Migrate_If_Version_Below_5280 ()
BEGIN
DECLARE
	CURRENT_DB_VERSION TEXT;
DECLARE
    SYSTEMS_TABLE_EXISTS INT;
    SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
        TABLE_NAME = 'Systems'
    AND table_schema = DATABASE() INTO SYSTEMS_TABLE_EXISTS;
    IF (SYSTEMS_TABLE_EXISTS > 0) THEN
	    SELECT
		    Value
	    FROM
		    Systems
	    WHERE
		    Name = 'Version' INTO CURRENT_DB_VERSION;
	    IF(INET_ATON(CURRENT_DB_VERSION) < INET_ATON('5.28.0')) THEN
		    UPDATE Commands SET PluginId = '' WHERE PluginId IS NULL;
	    END IF;
    END IF;
END;
	CALL Migrate_If_Version_Below_5280 ();
	DROP PROCEDURE IF EXISTS Migrate_If_Version_Below_5280;
