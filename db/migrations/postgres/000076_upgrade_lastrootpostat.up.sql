ALTER TABLE channels ALTER COLUMN LastRootPostAt SET DEFAULT '0'::bigint;

-- fixes migrate cte and sets the LastRootPostAt for channels that don't have it set
WITH q AS (
		SELECT
			Channels.Id channelid,
			COALESCE(MAX(Posts.CreateAt),
				0) AS lastrootpost
		FROM
			Channels
		LEFT JOIN Posts ON Channels.Id = Posts.ChannelId
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
UPDATE Channels SET LastRootPostAt=0 WHERE LastRootPostAt is NULL;
