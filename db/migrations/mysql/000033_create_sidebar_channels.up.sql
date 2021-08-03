CREATE TABLE IF NOT EXISTS SidebarChannels (
    ChannelId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    CategoryId varchar(26) NOT NULL,
    SortOrder bigint(20) DEFAULT NULL,
    PRIMARY KEY (ChannelId, UserId, CategoryId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SidebarChannels'
        AND table_schema = DATABASE()
        AND column_name = 'CategoryId'
        AND column_type != 'varchar(128)'
    ) > 0,
    'ALTER TABLE SidebarChannels MODIFY CategoryId varchar(128);',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
