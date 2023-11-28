SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND column_name = 'PluginID'
    ),
    'ALTER TABLE RemoteClusters ADD COLUMN PluginID varchar(190) NOT NULL DEFAULT \'\';',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;


SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostCreateAt'
    ),
    'ALTER TABLE SharedChannelRemotes ADD COLUMN LastPostCreateAt bigint NOT NULL DEFAULT 0;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;


SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostCreateID'
    ),
    'ALTER TABLE SharedChannelRemotes ADD COLUMN LastPostCreateID varchar(26);',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

-- rename `lastpostid` column only if it exists and the new name doesn't exist.
-- column rename should be O(1) on mysql > 5.5
SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostUpdateID'
    ),
        IF(
            EXISTS(
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE table_name = 'SharedChannelRemotes'
                AND table_schema = DATABASE()
                AND column_name = 'LastPostID'
        ), 
        'ALTER TABLE SharedChannelRemotes RENAME COLUMN LastPostID TO LastPostUpdateID;',    
        'SELECT 1;'     
        ),
    'SELECT 1;'
));

PREPARE renameColumnIfNeeded FROM @preparedStatement;
EXECUTE renameColumnIfNeeded;
DEALLOCATE PREPARE renameColumnIfNeeded;