SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'LastViewedPinnedPostAt'
    ) > 0,
    'ALTER TABLE ChannelMembers DROP COLUMN LastViewedPinnedPostAt;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
