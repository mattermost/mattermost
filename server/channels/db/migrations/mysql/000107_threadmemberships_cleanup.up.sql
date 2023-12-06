DELETE FROM
    tm USING ThreadMemberships AS tm
    JOIN Threads ON Threads.PostId = tm.PostId
WHERE
    (tm.UserId, Threads.ChannelId) NOT IN (SELECT UserId, ChannelId FROM ChannelMembers);
