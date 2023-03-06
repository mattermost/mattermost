SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'ConcatenatedBroadcastChannelIds'
    ),
    'ALTER TABLE IR_Incident ADD COLUMN ConcatenatedBroadcastChannelIds TEXT;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE IR_Incident SET
    ConcatenatedBroadcastChannelIds = (
        COALESCE(
            CONCAT_WS(
                ',',
                CASE WHEN AnnouncementChannelID = '' THEN NULL ELSE AnnouncementChannelID END,
                CASE WHEN BroadcastChannelID = ''  OR BroadcastChannelID = AnnouncementChannelID THEN NULL ELSE BroadcastChannelID END
            ),
        '')
    );
