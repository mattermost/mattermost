/* fixCRTThreadCountsAndUnreads Marks threads as read for users where the last
reply time of the thread is earlier than the time the user viewed the channel.
Marking a thread means setting the mention count to zero and setting the
last viewed at time of the the thread as the last viewed at time
of the channel */

CREATE PROCEDURE MigrateCRTThreadCountsAndUnreads ()
BEGIN
	IF(SELECT EXISTS(SELECT * FROM Systems WHERE Name = 'CRTThreadCountsAndUnreadsMigrationComplete') = 0) THEN
		UPDATE
			ThreadMemberships
			INNER JOIN (
				SELECT
					PostId,
					UserId,
					ChannelMembers.LastViewedAt AS CM_LastViewedAt,
					Threads.LastReplyAt
				FROM
					Threads
					INNER JOIN ChannelMembers ON ChannelMembers.ChannelId = Threads.ChannelId
				WHERE
					Threads.LastReplyAt <= ChannelMembers.LastViewedAt) AS q ON ThreadMemberships.Postid = q.PostId
				AND ThreadMemberships.UserId = q.UserId SET LastViewed = q.CM_LastViewedAt + 1, UnreadMentions = 0, LastUpdated = (
				SELECT
					(SELECT ROUND(UNIX_TIMESTAMP(NOW(3))*1000)));
		INSERT INTO Systems
			VALUES('CRTThreadCountsAndUnreadsMigrationComplete', 'true');
	END IF;
END;
	CALL MigrateCRTThreadCountsAndUnreads ();
	DROP PROCEDURE IF EXISTS MigrateCRTThreadCountsAndUnreads;
