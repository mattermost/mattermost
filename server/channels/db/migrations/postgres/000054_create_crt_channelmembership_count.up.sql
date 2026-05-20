/* fixCRTChannelMembershipCounts fixes the channel counts, i.e. the total message count,
total root message count, mention count, and mention count in root messages for users
who have viewed the channel after the last post in the channel */
DO $$
	<< migrate_crt_channelmembership_counts >>
BEGIN
	IF((
		SELECT
			COUNT(*)
		FROM systems
	WHERE
		Name = 'CRTChannelMembershipCountsMigrationComplete') = 0) THEN
		UPDATE
			ChannelMembers
		SET
			MentionCount = 0,
			MentionCountRoot = 0,
			MsgCount = Channels.TotalMsgCount,
			MsgCountRoot = Channels.TotalMsgCountRoot,
			LastUpdateAt = (
				SELECT
					(extract(epoch FROM now()) * 1000)::bigint)
			FROM
				Channels
			WHERE
				ChannelMembers.Channelid = Channels.Id
				AND ChannelMembers.LastViewedAt >= Channels.LastPostAt;
		INSERT INTO Systems
			VALUES('CRTChannelMembershipCountsMigrationComplete', 'true');
	END IF;
END migrate_crt_channelmembership_counts
$$;
