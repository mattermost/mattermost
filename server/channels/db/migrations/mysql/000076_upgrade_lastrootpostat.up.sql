CREATE PROCEDURE Migrate_LastRootPostAt_Default ()
BEGIN
	IF (
			SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_NAME = 'Channels'
			AND TABLE_SCHEMA = DATABASE()
			AND COLUMN_NAME = 'LastRootPostAt'
			AND (COLUMN_DEFAULT IS NULL OR COLUMN_DEFAULT != 0)
		) = 1 THEN
		ALTER TABLE Channels ALTER COLUMN LastRootPostAt SET DEFAULT 0;
	END IF;
END;
	CALL Migrate_LastRootPostAt_Default ();
	DROP PROCEDURE IF EXISTS Migrate_LastRootPostAt_Default;

CREATE PROCEDURE Migrate_LastRootPostAt_Fix ()
BEGIN
	IF (
		SELECT COUNT(*)
		FROM Channels
		WHERE LastRootPostAt IS NULL
	) > 0 THEN
	-- fixes migrate cte and sets the LastRootPostAt for channels that don't have it set
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
					Channels.Id) AS q ON q.channelid = Channels.Id
				SET
					LastRootPostAt = lastrootpost
				WHERE
					LastRootPostAt IS NULL;

		-- sets LastRootPostAt to 0, for channels with no posts
		UPDATE Channels SET LastRootPostAt=0 WHERE LastRootPostAt IS NULL;
	END IF;
END;
	CALL Migrate_LastRootPostAt_Fix ();
	DROP PROCEDURE IF EXISTS Migrate_LastRootPostAt_Fix;
