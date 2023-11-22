SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostCreateAt'
    ),
    'ALTER TABLE SharedChannelRemotes DROP COLUMN LastPostCreateAt;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;


SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostCreateID'
    ),
    'ALTER TABLE SharedChannelRemotes DROP COLUMN LastPostCreateID;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;

-- reverses the renaming of `lastpostid` column only if the old name does not exist and the new name does exist.
-- column rename should be O(1) on mysql > 5.5
SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'SharedChannelRemotes'
        AND table_schema = DATABASE()
        AND column_name = 'LastPostID'
    ),
        IF(
            EXISTS(
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE table_name = 'SharedChannelRemotes'
                AND table_schema = DATABASE()
                AND column_name = 'LastPostUpdateID'
        ), 
        'ALTER TABLE SharedChannelRemotes RENAME COLUMN LastPostUpdateID TO LastPostID;',    
        'SELECT 1;'     
        ),
    'SELECT 1;'
));

PREPARE renameColumnIfNeeded FROM @preparedStatement;
EXECUTE renameColumnIfNeeded;
DEALLOCATE PREPARE renameColumnIfNeeded;