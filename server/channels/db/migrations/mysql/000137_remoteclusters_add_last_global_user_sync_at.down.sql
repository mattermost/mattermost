SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'RemoteClusters'
        AND COLUMN_NAME = 'LastGlobalUserSyncAt'
    ) > 0,
    'ALTER TABLE RemoteClusters DROP COLUMN LastGlobalUserSyncAt',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;