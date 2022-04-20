SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ThreadMemberships'
        AND table_schema = DATABASE()
        AND column_name = 'SeenReplyCount'
    ),
    'ALTER TABLE ThreadMemberships ADD COLUMN SeenReplyCount bigint(20) DEFAULT 0;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE
	ThreadMemberships, Threads
SET
	SeenReplyCount = Threads.ReplyCount WHERE ThreadMemberships.LastViewed >= Threads.LastreplyAt AND ThreadMemberships.PostId = Threads.PostId;

UPDATE
	ThreadMemberships, Threads
SET
	SeenReplyCount = (SELECT COUNT(Posts.Id) FROM Posts WHERE Posts.DeleteAt = 0 AND Posts.RootId = ThreadMemberships.PostId AND Posts.CreateAt < ThreadMemberships.LastViewed)
WHERE
	ThreadMemberships.LastViewed < Threads.LastReplyAt AND ThreadMemberships.PostId = Threads.PostId;
