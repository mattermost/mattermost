CREATE PROCEDURE Migrate_LastRootPostAt ()
BEGIN
DECLARE
	LastRootPostAt_EXIST INT;
	SELECT
		COUNT(*)
	FROM
		INFORMATION_SCHEMA.COLUMNS
	WHERE
		TABLE_NAME = 'Channels'
		AND table_schema = DATABASE()
		AND COLUMN_NAME = 'LastRootPostAt' INTO LastRootPostAt_EXIST;
	IF(LastRootPostAt_EXIST = 0) THEN
        ALTER TABLE Channels ADD COLUMN LastRootPostAt bigint DEFAULT 0;
		UPDATE
			Channels
			INNER JOIN (
				SELECT
					Channels.Id channelid,
					COALESCE(MAX(Posts.CreateAt), 0) AS lastrootpost
				FROM
					Channels
					LEFT JOIN Posts FORCE INDEX (idx_posts_channel_id_update_at) ON Channels.Id = Posts.ChannelId
				WHERE
					Posts.RootId = ''
				GROUP BY
					Channels.Id) AS q ON q.channelid = Channels.Id SET LastRootPostAt = lastrootpost;
	END IF;
END;
	CALL Migrate_LastRootPostAt ();
	DROP PROCEDURE IF EXISTS Migrate_LastRootPostAt;
