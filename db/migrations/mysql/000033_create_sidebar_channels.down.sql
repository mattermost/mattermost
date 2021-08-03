SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SidebarChannels'
        AND table_schema = DATABASE()
        AND column_name = 'CategoryId'
        AND column_type != 'varchar(26)'
    ) > 0,
    'ALTER TABLE SidebarChannels MODIFY CategoryId varchar(26);',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS SidebarChannels;
