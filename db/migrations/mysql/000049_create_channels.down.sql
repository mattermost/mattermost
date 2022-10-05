SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_name'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channels_name ON Channels(Name);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'Shared'
    ) > 0,
    'ALTER TABLE Channels DROP COLUMN Shared;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_scheme_id'
    ) > 0,
    'DROP INDEX idx_channels_scheme_id ON Channels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT column_type FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'GroupConstrained'
    ) != 'tinyint(4)',
    'ALTER TABLE Channels MODIFY GroupConstrained tinyint(4);',
    'SELECT 1'
));

PREPARE alterIfTypeDifferent FROM @preparedStatement;
EXECUTE alterIfTypeDifferent;
DEALLOCATE PREPARE alterIfTypeDifferent;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'GroupConstrained'
    ) > 0,
    'ALTER TABLE Channels DROP COLUMN GroupConstrained;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_txt'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channels_txt ON Channels(Name,DisplayName);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'SchemeId'
    ) > 0,
    'ALTER TABLE Channels DROP COLUMN SchemeId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_displayname'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channels_displayname ON Channels(DisplayName);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT column_type FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'Purpose'
    ) != 'varchar(64)',
    'ALTER TABLE Channels MODIFY Purpose varchar(64);',
    'SELECT 1'
));

PREPARE alterIfTypeDifferent FROM @preparedStatement;
EXECUTE alterIfTypeDifferent;
DEALLOCATE PREPARE alterIfTypeDifferent;

DROP TABLE IF EXISTS Channels;
