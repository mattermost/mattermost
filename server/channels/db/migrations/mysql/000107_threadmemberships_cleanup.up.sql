DELETE FROM
    tm USING ThreadMemberships AS tm
    JOIN Threads ON Threads.PostId = tm.PostId
    LEFT JOIN ChannelMembers ON ChannelMembers.UserId = tm.UserId
    AND Threads.ChannelId = ChannelMembers.ChannelId
WHERE
    ChannelMembers.ChannelId IS NULL;
