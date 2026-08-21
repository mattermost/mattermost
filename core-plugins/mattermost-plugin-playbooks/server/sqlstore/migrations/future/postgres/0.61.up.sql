ALTER TABLE IR_Playbook ADD COLUMN IF NOT EXISTS ChannelID VARCHAR(26) DEFAULT '';
ALTER TABLE IR_Playbook ADD COLUMN IF NOT EXISTS ChannelMode VARCHAR(32) DEFAULT 'create_new_channel';

-- Drop unique constraint and kee the index
ALTER TABLE IR_Incident DROP CONSTRAINT IF EXISTS ir_incident_channelid_key:

-- update empty names on incident table with channels data
UPDATE IR_Incident i
SET name=c.DisplayName
FROM Channels c
WHERE  c.id=i.ChannelID AND i.Name='';
