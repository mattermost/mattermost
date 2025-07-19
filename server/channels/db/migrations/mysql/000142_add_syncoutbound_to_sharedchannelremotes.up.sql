SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'SyncOutbound'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE SharedChannelRemotes ADD COLUMN SyncOutbound boolean DEFAULT TRUE;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;