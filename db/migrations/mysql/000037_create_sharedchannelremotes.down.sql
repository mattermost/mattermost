SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostId'
    ) > 0,
    'ALTER TABLE SharedChannelRemotes DROP COLUMN LastPostId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostUpdateAt'
    ) > 0,
    'ALTER TABLE SharedChannelRemotes DROP COLUMN LastPostUpdateAt;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

DROP TABLE IF EXISTS SharedChannelRemotes;
