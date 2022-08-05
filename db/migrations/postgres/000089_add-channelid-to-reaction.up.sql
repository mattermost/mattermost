ALTER TABLE reactions ADD COLUMN IF NOT EXISTS channelid varchar(26) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_posts_id_channel_id on posts (id, channelid);
UPDATE reactions SET channelid = COALESCE((select channelid from posts where posts.id = reactions.postid), '') WHERE channelid='';
CREATE INDEX IF NOT EXISTS idx_reactions_channel_id on reactions (channelid);
