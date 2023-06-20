CREATE TABLE IF NOT EXISTS Threads (
    PostId varchar(26) NOT NULL,
    ReplyCount bigint(20),
    LastReplyAt bigint(20),
    Participants text,
    PRIMARY KEY (PostId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Threads ADD COLUMN ChannelId VARCHAR(26) DEFAULT NULL;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND index_name = 'idx_threads_channel_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_threads_channel_id ON Threads(ChannelId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

CREATE PROCEDURE Migrate_Empty_Threads ()
BEGIN
DECLARE
	EMPTY_THREADS_EXIST INT;
	SELECT
		COUNT(*)
	FROM
		Threads
	WHERE
		ChannelId IS NULL INTO EMPTY_THREADS_EXIST;
	IF(EMPTY_THREADS_EXIST > 0) THEN
		UPDATE
			Threads
			INNER JOIN Posts ON Posts.Id = Threads.PostId
		SET
			Threads.ChannelId = Posts.ChannelId
		WHERE
			Threads.ChannelId IS NULL;
		END IF;
END;
	CALL Migrate_Empty_Threads ();
	DROP PROCEDURE IF EXISTS Migrate_Empty_Threads;
