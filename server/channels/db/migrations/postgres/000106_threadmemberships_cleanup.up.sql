DELETE FROM threadmemberships WHERE (postid, userid) IN (
    SELECT
        threadmemberships.postid,
        threadmemberships.userid
    FROM
        threadmemberships
        JOIN threads ON threads.postid = threadmemberships.postid
        LEFT JOIN channelmembers ON channelmembers.userid = threadmemberships.userid
            AND threads.channelid = channelmembers.channelid
        JOIN channels ON channels.id = threads.channelid
    WHERE
        channelmembers.channelid IS NULL
        AND Channels.Type != 'D'
        AND Channels.Type != 'G'
);
