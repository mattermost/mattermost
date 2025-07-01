SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastMembersSyncAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SharedChannelRemotes ADD LastMembersSyncAt bigint DEFAULT 0;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement2 = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelUsers'
        AND table_schema = DATABASE()
        AND column_name = 'LastMembershipSyncAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SharedChannelUsers ADD LastMembershipSyncAt bigint DEFAULT 0;'
));

PREPARE alterIfNotExists2 FROM @preparedStatement2;
EXECUTE alterIfNotExists2;
DEALLOCATE PREPARE alterIfNotExists2;