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
);

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Roles'
        AND table_schema = DATABASE()
        AND column_name = 'BuiltIn'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Roles ADD BuiltIn tinyint(1) DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

UPDATE Roles SET SchemeManaged = 0
WHERE Name NOT IN ('system_user', 'system_admin', 'team_user', 'team_admin', 'channel_user', 'channel_admin');
