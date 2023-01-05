SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'LastViewedPinnedPostAt'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE ChannelMembers ADD COLUMN LastViewedPinnedPostAt bigint(20) NOT NULL DEFAULT 0;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
