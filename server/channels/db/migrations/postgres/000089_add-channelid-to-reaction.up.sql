ALTER TABLE reactions ADD COLUMN IF NOT EXISTS channelid varchar(26) NOT NULL DEFAULT '';
UPDATE reactions SET channelid = COALESCE((select channelid from posts where posts.id = reactions.postid), '') WHERE channelid='';
CREATE INDEX IF NOT EXISTS idx_reactions_channel_id on reactions (channelid);
