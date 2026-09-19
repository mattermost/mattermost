ALTER TABLE IR_Playbook DROP COLUMN IF EXISTS ChannelID;
ALTER TABLE IR_Playbook DROP COLUMN IF EXISTS ChannelMode;

-- add unique constraint to channelid index
DO
$$
BEGIN
    IF NOT EXISTS (
        SELECT INDEXNAME FROM PG_INDEXES
        WHERE TABLENAME = 'ir_incident'
        AND INDEXNAME = 'ir_incident_channelid_key'
    ) THEN
        ALTER TABLE IR_Incident ADD CONSTRAINT ir_incident_channelid_key UNIQUE(ChannelID);
	END IF;
END
$$;


