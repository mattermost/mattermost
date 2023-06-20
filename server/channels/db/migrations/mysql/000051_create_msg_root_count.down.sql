SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'MsgCountRoot'
    ) > 0,
    'ALTER TABLE ChannelMembers DROP COLUMN MsgCountRoot;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'MentionCountRoot'
    ) > 0,
    'ALTER TABLE ChannelMembers DROP COLUMN MentionCountRoot;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'TotalMsgCountRoot'
    ) > 0,
    'ALTER TABLE Channels DROP COLUMN TotalMsgCountRoot;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
