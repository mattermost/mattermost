DO $$
BEGIN
	IF (
		SELECT count(*)
		FROM information_schema.columns
		WHERE table_schema='public'
		AND table_name='channels'
		AND column_name='lastrootpostat'
		AND (column_default IS NULL OR column_default != '''0''::bigint')
	) = 1 THEN
		ALTER TABLE channels ALTER COLUMN lastrootpostat SET DEFAULT '0'::bigint;
	END IF;
END$$;

DO $$
BEGIN
	IF (
		SELECT count(*)
		FROM Channels
		WHERE LastRootPostAt IS NULL
	) > 0 THEN
		-- fixes migrate cte and sets the LastRootPostAt for channels that don't have it set
		WITH q AS (
			SELECT
				Channels.Id channelid,
				COALESCE(MAX(Posts.CreateAt), 0) AS lastrootpost
			FROM
				Channels
			LEFT JOIN
				Posts
			ON
				Channels.Id = Posts.ChannelId
			WHERE
				Posts.RootId = ''
			GROUP BY
				Channels.Id
		)
		UPDATE
			Channels
		SET
			LastRootPostAt = q.lastrootpost
		FROM
			q
		WHERE
			q.channelid = Channels.Id AND Channels.LastRootPostAt IS NULL;

		-- sets LastRootPostAt to 0, for channels with no posts
		UPDATE Channels SET LastRootPostAt=0 WHERE LastRootPostAt IS NULL;
	END IF;
END $$;
