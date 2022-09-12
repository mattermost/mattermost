SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeGuest'
    ) > 0,
    'ALTER TABLE ChannelMembers DROP COLUMN UrgentMentionCount;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeGuest'
    ) > 0,
    'ALTER TABLE Threads DROP COLUMN IsUrgent;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
