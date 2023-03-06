SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Playbook'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelID'
    ),
    'ALTER TABLE IR_Playbook ADD COLUMN ChannelID VARCHAR(26) DEFAULT "";',
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
        AND column_name = 'ChannelMode'
    ),
    'ALTER TABLE IR_Playbook ADD COLUMN ChannelMode VARCHAR(32) DEFAULT "create_new_channel";',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

--  We drop entirely the unique index for MySQL, there's an additional index on ChannelID that is kept
SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_Incident'
        AND index_schema = DATABASE()
        AND index_name = 'ChannelID'
    ),
    'DROP INDEX ChannelID ON IR_Incident;',
    'SELECT 1;'
));

PREPARE dropIndexIfExists FROM @preparedStatement;
EXECUTE dropIndexIfExists;
DEALLOCATE PREPARE dropIndexIfExists;

-- update names from channel display names
UPDATE IR_Incident i
JOIN Channels c ON c.id=i.ChannelID AND i.Name=''
SET i.name=c.DisplayName
