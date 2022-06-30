ALTER TABLE reactions ADD COLUMN IF NOT EXISTS channelid varchar(26);
UPDATE reactions SET channelid = (select channelid from posts where posts.id = reactions.postid);
ALTER TABLE reactions ALTER column channelid set not null;
CREATE INDEX IF NOT EXISTS idx_reactions_channel_id on reactions (channelid);
