SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'SidebarChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sidebarchannels_categoryid'
    ) > 0,
    'SELECT 1',
    'DROP INDEX idx_sidebarchannels_categoryid ON SidebarChannels;'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
