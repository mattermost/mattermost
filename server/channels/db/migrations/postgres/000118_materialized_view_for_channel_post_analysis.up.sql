CREATE MATERIALIZED VIEW IF NOT EXISTS channelpoststats AS
SELECT channelid, to_timestamp(posts.createat/1000)::date as day, COUNT(*) as numposts
FROM posts
         join channels on posts.channelid = channels.id
WHERE posts.deleteat = 0
  AND channels.type IN ('P', 'O')
GROUP BY channelid, day;

create index if not exists cps_channel_id on channelpoststats(channelid);
create index if not exists cps_day on channelpoststats(day);
