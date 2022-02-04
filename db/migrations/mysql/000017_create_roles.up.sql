CREATE TABLE IF NOT EXISTS Roles (
   Id varchar(26) NOT NULL,
   Name varchar(64) DEFAULT NULL,
   DisplayName varchar(128) DEFAULT NULL,
   Description text,
   CreateAt bigint(20) DEFAULT NULL,
   UpdateAt bigint(20) DEFAULT NULL,
   DeleteAt bigint(20) DEFAULT NULL,
   Permissions text,
   SchemeManaged tinyint(1) DEFAULT NULL,
   PRIMARY KEY (Id),
   UNIQUE KEY Name (Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Roles'
        AND table_schema = DATABASE()
        AND column_name = 'BuiltIn'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Roles ADD BuiltIn tinyint(1) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

CREATE PROCEDURE Migrate_If_Version_Below_500 ()
BEGIN
DECLARE
	CURRENT_DB_VERSION TEXT;
	SELECT
		Value
	FROM
		Systems
	WHERE
		Name = 'Version' INTO CURRENT_DB_VERSION;
	IF(INET_ATON(CURRENT_DB_VERSION) < INET_ATON('5.0.0')) THEN
		UPDATE Roles SET SchemeManaged = 0
            WHERE Name NOT IN ('system_user', 'system_admin', 'team_user', 'team_admin', 'channel_user', 'channel_admin');
	END IF;
END;
	CALL Migrate_If_Version_Below_500 ();
	DROP PROCEDURE IF EXISTS Migrate_If_Version_Below_500;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Roles'
        AND table_schema = DATABASE()
        AND column_name = 'Permissions'
    ) > 0,
    'ALTER TABLE Roles MODIFY Permissions longtext;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
