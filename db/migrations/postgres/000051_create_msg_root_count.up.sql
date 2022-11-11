DO $$
<<migrate_root_mention_count>>
DECLARE 
    mention_count_root_exist boolean := false;
DECLARE
    msg_count_root_exist boolean := false;
DECLARE
	tmp_count_root integer := 0;
BEGIN
SELECT count(*) != 0 INTO msg_count_root_exist
    FROM information_schema.columns
    WHERE table_name = 'channels'
    AND table_schema = current_schema()
    AND column_name = 'totalmsgcountroot';

 SELECT count(*) != 0 INTO mention_count_root_exist
    FROM information_schema.columns
    WHERE table_name = 'channelmembers'
    AND table_schema = current_schema()
    AND column_name = 'mentioncountroot';

IF mention_count_root_exist THEN
	tmp_count_root := (SELECT count(*) FROM channelmembers WHERE msgcountroot IS NULL OR mentioncountroot IS NULL);
END IF;

ALTER TABLE channelmembers ADD COLUMN IF NOT EXISTS mentioncountroot bigint;

IF (tmp_count_root > 0) THEN
	WITH q AS (
		SELECT ChannelId, COALESCE(SUM(UnreadMentions), 0) AS UnreadMentions, UserId
		FROM ThreadMemberships
		LEFT JOIN Threads ON ThreadMemberships.PostId = Threads.PostId
		GROUP BY Threads.ChannelId, ThreadMemberships.UserId
	)
			UPDATE channelmembers
			SET MentionCountRoot = ChannelMembers.MentionCount - q.UnreadMentions
			FROM q
			WHERE
				q.ChannelId = ChannelMembers.ChannelId AND
				q.UserId = ChannelMembers.UserId AND
				ChannelMembers.MentionCount > 0;
END IF;

ALTER TABLE channels ADD COLUMN IF NOT EXISTS totalmsgcountroot bigint;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS lastrootat bigint;

ALTER TABLE channelmembers ADD COLUMN IF NOT EXISTS msgcountroot bigint;

IF NOT msg_count_root_exist THEN
		WITH q AS (
		SELECT Channels.Id channelid, COALESCE(COUNT(*),0) newcount, COALESCE(MAX(Posts.CreateAt), 0) as lastpost
		FROM Channels
		LEFT JOIN Posts  ON Channels.Id = Posts.ChannelId
		WHERE Posts.RootId = ''
		GROUP BY Channels.Id
	)
		UPDATE Channels SET TotalMsgCountRoot = q.newcount, LastRootAt=q.lastpost
		FROM q where q.channelid=Channels.Id;
END IF;

IF NOT mention_count_root_exist THEN
		WITH q as (SELECT TotalMsgCountRoot, Id, LastRootAt from Channels)
		UPDATE ChannelMembers CM SET MsgCountRoot=TotalMsgCountRoot
		FROM q WHERE q.id=CM.ChannelId AND LastViewedAt >= q.lastrootat;
END IF;

ALTER TABLE channels DROP COLUMN IF EXISTS lastrootat;

END migrate_root_mention_count $$;
