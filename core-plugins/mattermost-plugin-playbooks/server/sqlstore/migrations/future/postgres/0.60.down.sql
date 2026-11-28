ALTER TABLE IR_Incident DROP COLUMN IF EXISTS CreateChannelMemberOnNewParticipant;
ALTER TABLE IR_Incident DROP COLUMN IF EXISTS RemoveChannelMemberOnRemovedParticipant;
ALTER TABLE IR_Playbook DROP COLUMN IF EXISTS CreateChannelMemberOnNewParticipant;
ALTER TABLE IR_Playbook DROP COLUMN IF EXISTS RemoveChannelMemberOnRemovedParticipant;
