ALTER TABLE Channels ALTER COLUMN LastRootPostAt SET DEFAULT 0;

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
UPDATE Channels SET LastRootPostAt=0 WHERE LastRootPostAt is NULL;
