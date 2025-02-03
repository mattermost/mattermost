SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'RemoteClusters'
        AND table_schema = DATABASE()
        AND column_name = 'PluginID'
    ),
    'ALTER TABLE RemoteClusters DROP COLUMN PluginID;',
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

