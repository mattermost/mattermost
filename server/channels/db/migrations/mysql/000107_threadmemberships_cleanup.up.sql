DELETE FROM
    tm USING ThreadMemberships AS tm
    JOIN Threads ON Threads.PostId = tm.PostId
    JOIN Channels ON Channels.Id = Threads.ChannelId
    LEFT JOIN ChannelMembers ON ChannelMembers.UserId = tm.UserId
    AND Threads.ChannelId = ChannelMembers.ChannelId
WHERE
    ChannelMembers.ChannelId IS NULL
    AND Channels.Type != 'D'
    AND Channels.Type != 'G';
