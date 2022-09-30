-- Drop any existing DeleteAt column from 000081_threads_deleteat.up.sql
SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ) > 0,
    'ALTER TABLE Threads DROP COLUMN DeleteAt;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;

SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'ThreadDeleteAt'
    ),
    'ALTER TABLE Threads ADD COLUMN ThreadDeleteAt bigint(20);',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE Threads, Posts
SET Threads.ThreadDeleteAt = Posts.DeleteAt
WHERE Posts.Id = Threads.PostId
AND Threads.ThreadDeleteAt IS NULL;
