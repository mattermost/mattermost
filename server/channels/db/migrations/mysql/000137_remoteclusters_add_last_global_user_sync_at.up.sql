SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'RemoteClusters'
        AND COLUMN_NAME = 'LastGlobalUserSyncAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE RemoteClusters ADD COLUMN LastGlobalUserSyncAt bigint DEFAULT 0'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;