SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND column_name = 'CreateChannelMemberOnNewParticipant'
    ),
    'ALTER TABLE IR_Playbook ADD COLUMN CreateChannelMemberOnNewParticipant BOOLEAN DEFAULT TRUE;',
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
        AND column_name = 'RemoveChannelMemberOnRemovedParticipant'
    ),
    'ALTER TABLE IR_Playbook ADD COLUMN RemoveChannelMemberOnRemovedParticipant BOOLEAN DEFAULT TRUE;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;


SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'CreateChannelMemberOnNewParticipant'
    ),
    'ALTER TABLE IR_Incident ADD COLUMN CreateChannelMemberOnNewParticipant BOOLEAN DEFAULT TRUE;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;


SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'RemoveChannelMemberOnRemovedParticipant'
    ),
    'ALTER TABLE IR_Incident ADD COLUMN RemoveChannelMemberOnRemovedParticipant BOOLEAN DEFAULT TRUE;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

