SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND column_name = 'ConcatenatedBroadcastChannelIds'
    ),
    'ALTER TABLE IR_Playbook ADD COLUMN ConcatenatedBroadcastChannelIds TEXT;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND column_name = 'BroadcastEnabled'
    ),
    'ALTER TABLE IR_Playbook ADD COLUMN BroadcastEnabled BOOLEAN DEFAULT FALSE;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;


UPDATE IR_Playbook SET
    ConcatenatedBroadcastChannelIds = (
        COALESCE(
            CONCAT_WS(
                ',',
                CASE WHEN AnnouncementChannelID = '' THEN NULL ELSE AnnouncementChannelID END,
                CASE WHEN BroadcastChannelID = ''  OR BroadcastChannelID = AnnouncementChannelID THEN NULL ELSE BroadcastChannelID END
            ),
        '')
    )
, BroadcastEnabled = (CASE
    WHEN BroadcastChannelID != '' THEN TRUE
    WHEN AnnouncementChannelEnabled = TRUE THEN TRUE
    ELSE FALSE
END)
