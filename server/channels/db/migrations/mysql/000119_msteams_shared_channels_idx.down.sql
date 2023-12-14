SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND index_name = 'remote_clusters_pluginid_unique'
    ) > 0,
    'DROP INDEX remote_clusters_pluginid_unique ON RemoteClusters;',
    'SELECT 1;'
));

PREPARE dropIndexIfExists FROM @preparedStatement;
EXECUTE dropIndexIfExists;
DEALLOCATE PREPARE dropIndexIfExists;