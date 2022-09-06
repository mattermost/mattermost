SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'TeamId'
    ),
    'ALTER TABLE Threads ADD COLUMN TeamId varchar(26) DEFAULT NULL;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE Threads, Channels
SET Threads.TeamId = Channels.TeamId
WHERE Channels.Id = Threads.ChannelId
AND Threads.TeamId IS NULL;
