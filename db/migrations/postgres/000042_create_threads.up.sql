CREATE TABLE IF NOT EXISTS threads (
    postid VARCHAR(26) PRIMARY KEY,
    replycount bigint,
    lastreplyat bigint,
    participants text
);

ALTER TABLE threads ADD COLUMN IF NOT EXISTS channelid VARCHAR(26);

CREATE INDEX IF NOT EXISTS idx_threads_channel_id ON threads (channelid);

DO $$
	<< migrate_empty_threads >>
DECLARE
	empty_threads_exist boolean := FALSE;
BEGIN
	SELECT
		count(*) != 0 INTO empty_threads_exist
	FROM
		threads
	WHERE
		channelid IS NULL;
	IF empty_threads_exist THEN
		UPDATE
			threads
		SET
			channelId = posts.channelid
		FROM
			posts
		WHERE
			posts.id = threads.postid
			AND threads.channelid IS NULL;
	END IF;
END migrate_empty_threads
$$;
