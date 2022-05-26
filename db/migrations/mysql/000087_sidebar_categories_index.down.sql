SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'SidebarCategories'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sidebarcategories_userid_teamid'
    ) > 0,
    'DROP INDEX idx_sidebarcategories_userid_teamid on SidebarCategories;',
    'SELECT 1;'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
