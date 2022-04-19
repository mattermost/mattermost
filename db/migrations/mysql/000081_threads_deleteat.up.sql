SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ),
    'ALTER TABLE Threads ADD COLUMN DeleteAt bigint(20);',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE Threads, Posts
SET Threads.DeleteAt = Posts.DeleteAt
WHERE Posts.Id = Threads.PostId
AND Threads.DeleteAt IS NULL;
