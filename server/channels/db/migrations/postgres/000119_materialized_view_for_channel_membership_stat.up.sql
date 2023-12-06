CREATE MATERIALIZED VIEW IF NOT EXISTS channelmemberstats AS
SELECT c.id, count(cm) AS usercount
FROM channels AS c
         LEFT JOIN channelmembers AS cm ON c.id = cm.channelid
         LEFT JOIN users AS u ON cm.userid = u.id
WHERE c.type IN ('O', 'P')
  AND u.deleteat = 0
  AND u.id not in (SELECT userid FROM bots)
GROUP BY c.id;

CREATE INDEX IF NOT EXISTS IDX_cms_id ON channelmemberstats(id);
