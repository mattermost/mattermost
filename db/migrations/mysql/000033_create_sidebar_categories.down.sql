SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SidebarCategories'
        AND table_schema = DATABASE()
        AND column_name = 'Collapsed'
    ) > 0,
    'ALTER TABLE SidebarCategories DROP COLUMN Collapsed;',
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
    'ALTER TABLE SidebarCategories DROP COLUMN Muted;',
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
        AND column_name = 'Id'
        AND column_type != 'varchar(26)'
    ) > 0,
    'ALTER TABLE SidebarCategories MODIFY Id varchar(26);',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS SidebarCategories;
