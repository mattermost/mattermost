SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ),
    'ALTER TABLE ThreadMemberships ADD COLUMN DeleteAt bigint(20);',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE
    ThreadMemberships
    JOIN Threads ON Threads.PostId = ThreadMemberships.PostId
    LEFT JOIN ChannelMembers ON ChannelMembers.UserId = ThreadMemberships.UserId
    AND Threads.ChannelId = ChannelMembers.ChannelId
SET
    DeleteAt = UNIX_TIMESTAMP() * 1000
WHERE
    ChannelMembers.ChannelId IS NULL;
