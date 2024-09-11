SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND index_name = 'remote_clusters_site_url_unique'
    ) > 0,
    'DROP INDEX remote_clusters_site_url_unique ON RemoteClusters;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE RemoteClusters ADD DeleteAt bigint(20) DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SharedChannelRemotes ADD DeleteAt bigint(20) DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
