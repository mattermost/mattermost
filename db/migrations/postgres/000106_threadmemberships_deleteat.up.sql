ALTER TABLE threadmemberships ADD COLUMN IF NOT EXISTS deleteat bigint;

UPDATE
    threadmemberships
SET
    deleteat = FLOOR(EXTRACT(epoch FROM NOW()) * 1000)
WHERE
    EXISTS (
        SELECT
        FROM
            threads
        LEFT JOIN channelmembers ON channelmembers.userid = threadmemberships.userid
            AND threads.channelid = channelmembers.channelid
    WHERE
        threads.postid = threadmemberships.postid
        AND channelmembers.channelid IS NULL);
