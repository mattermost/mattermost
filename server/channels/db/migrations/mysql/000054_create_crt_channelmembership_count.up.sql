/* fixCRTChannelMembershipCounts fixes the channel counts, i.e. the total message count,
total root message count, mention count, and mention count in root messages for users
who have viewed the channel after the last post in the channel */

CREATE PROCEDURE MigrateCRTChannelMembershipCounts ()
BEGIN
	IF(
		SELECT
			EXISTS (
			SELECT
				* FROM Systems
			WHERE
				Name = 'CRTChannelMembershipCountsMigrationComplete') = 0) THEN
		UPDATE
			ChannelMembers
			INNER JOIN Channels ON Channels.Id = ChannelMembers.ChannelId SET
				MentionCount = 0, MentionCountRoot = 0, MsgCount = Channels.TotalMsgCount, MsgCountRoot = Channels.TotalMsgCountRoot, LastUpdateAt = (
				SELECT
					(SELECT ROUND(UNIX_TIMESTAMP(NOW(3))*1000)))
	WHERE
		ChannelMembers.LastViewedAt >= Channels.LastPostAt;
		INSERT INTO Systems
			VALUES('CRTChannelMembershipCountsMigrationComplete', 'true');
	END IF;
END;
	CALL MigrateCRTChannelMembershipCounts ();
	DROP PROCEDURE IF EXISTS MigrateCRTChannelMembershipCounts;
