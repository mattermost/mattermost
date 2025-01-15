CREATE MATERIALIZED VIEW IF NOT EXISTS posts_by_team_day as
SELECT to_timestamp(p.createat/1000)::date as day, COUNT(*) as num, teamid
FROM posts p JOIN channels c on p.channelid=c.id
GROUP BY day, c.teamid;

CREATE MATERIALIZED VIEW IF NOT EXISTS bot_posts_by_team_day as
SELECT to_timestamp(p.createat/1000)::date as day, COUNT(*) as num, teamid
FROM posts p
JOIN Bots b ON p.UserId = b.Userid
JOIN channels c on p.channelid=c.id
GROUP BY day, c.teamid;
