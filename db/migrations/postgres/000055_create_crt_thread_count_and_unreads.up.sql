/* fixCRTThreadCountsAndUnreads Marks threads as read for users where the last
reply time of the thread is earlier than the time the user viewed the channel.
Marking a thread means setting the mention count to zero and setting the
last viewed at time of the the thread as the last viewed at time
of the channel */
DO $$
	<< migrate_crt_thread_counts_and_unreads >>
BEGIN
	IF((
		SELECT
			COUNT(*)
		FROM systems
	WHERE
		Name = 'CRTThreadCountsAndUnreadsMigrationComplete') = 0) THEN
		WITH q AS (
			SELECT
				PostId,
				UserId,
				ChannelMembers.LastViewedAt AS CM_LastViewedAt,
				Threads.LastReplyAt
			FROM
				Threads
				INNER JOIN ChannelMembers ON ChannelMembers.ChannelId = Threads.ChannelId
			WHERE
				Threads.LastReplyAt <= ChannelMembers.LastViewedAt
)
UPDATE
	ThreadMemberships
SET
	LastViewed = q.CM_LastViewedAt + 1,
	UnreadMentions = 0,
	LastUpdated = (
		SELECT
			(extract(epoch FROM now()) * 1000)::bigint)
	FROM
		q
	WHERE
		ThreadMemberships.Postid = q.PostId
		AND ThreadMemberships.UserId = q.UserId;
	INSERT INTO systems
		VALUES('CRTThreadCountsAndUnreadsMigrationComplete', 'true');
END IF;
END migrate_crt_thread_counts_and_unreads
$$;
