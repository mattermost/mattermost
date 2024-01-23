CREATE MATERIALIZED VIEW IF NOT EXISTS channelpoststats AS
SELECT channels.id AS channelid, to_timestamp(channels.createat/1000)::date as day, COUNT(posts) as numposts
FROM channels
         left join posts on posts.channelid = channels.id AND posts.deleteat = 0
WHERE channels.type IN ('P', 'O')
GROUP BY channels.id, day;
