ALTER TABLE users ADD COLUMN IF NOT EXISTS lastlogin bigint NOT NULL DEFAULT 0;

CREATE MATERIALIZED VIEW IF NOT EXISTS poststats AS
SELECT userid, to_timestamp(createat/1000)::date as day, COUNT(*) as numposts, MAX(CreateAt) as lastpostdate
FROM posts 
GROUP BY userid, day
;
