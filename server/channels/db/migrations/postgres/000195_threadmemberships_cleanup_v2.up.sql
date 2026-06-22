-- Drop ThreadMembership rows whose user is no longer a member of the thread's channel.
DELETE FROM threadmemberships WHERE (postid, userid) IN (
    SELECT
        threadmemberships.postid,
        threadmemberships.userid
    FROM
        threadmemberships
        JOIN threads ON threads.postid = threadmemberships.postid
        LEFT JOIN channelmembers ON channelmembers.userid = threadmemberships.userid
            AND threads.channelid = channelmembers.channelid
    WHERE
        channelmembers.channelid IS NULL
);
