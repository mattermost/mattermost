ALTER TABLE IR_Playbook ADD COLUMN IF NOT EXISTS ConcatenatedBroadcastChannelIds TEXT;
ALTER TABLE IR_Playbook ADD COLUMN IF NOT EXISTS BroadcastEnabled BOOLEAN DEFAULT FALSE;

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
