DELETE FROM threadmemberships WHERE EXISTS (
    SELECT
        threadmemberships.*
    FROM
        threadmemberships
        JOIN threads ON threads.PostId = threadmemberships.postid
        LEFT JOIN channelmembers ON channelmembers.userid = threadmemberships.userid
            AND threads.channelid = channelmembers.channelid
        JOIN channels ON channels.id = threads.channelid
    WHERE
        threads.postid = threadmemberships.postid
        AND channelmembers.channelid IS NULL
        AND (Channels.Type != 'D'
            OR Channels.Type != 'G')
);
