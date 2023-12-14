SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND index_name = 'remote_clusters_pluginid_unique'
    ) > 0,
    'SELECT 1;',
    'CREATE UNIQUE INDEX remote_clusters_pluginid_unique ON RemoteClusters (PluginID);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;