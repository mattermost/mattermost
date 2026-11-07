ALTER TABLE IR_Incident ADD COLUMN IF NOT EXISTS ConcatenatedBroadcastChannelIds TEXT;

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
