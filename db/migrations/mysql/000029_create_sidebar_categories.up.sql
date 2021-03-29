CREATE TABLE IF NOT EXISTS SidebarCategories (
    Id varchar(128) NOT NULL,
    UserId varchar(26) DEFAULT NULL,
    TeamId varchar(26) DEFAULT NULL,
    SortOrder bigint(20) DEFAULT NULL,
    Sorting varchar(64) DEFAULT NULL,
    Type varchar(64) DEFAULT NULL,
    DisplayName varchar(64) DEFAULT NULL,
    Muted tinyint(1) DEFAULT 0,
    Collapsed tinyint(1) DEFAULT 0,
    PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SidebarCategories'
        AND table_schema = DATABASE()
        AND column_name = 'Id'
    ) > 0,
    'ALTER TABLE SidebarCategories MODIFY Id varchar(128);',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SidebarCategories'
        AND table_schema = DATABASE()
        AND column_name = 'Muted'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SidebarCategories ADD COLUMN Muted tinyint(1) DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SidebarCategories'
        AND table_schema = DATABASE()
        AND column_name = 'Collapsed'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SidebarCategories ADD COLUMN Collapsed tinyint(1) DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
