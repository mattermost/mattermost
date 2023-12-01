CREATE MATERIALIZED VIEW IF NOT EXISTS postchannelstats AS
SELECT channelid, to_timestamp(channels.createat/1000)::date as day, COUNT(*) as numposts
FROM posts
         join channels on posts.channelid = channels.id
WHERE posts.deleteat = 0
  AND channels.type IN ('P', 'O')
GROUP BY channelid, day;
