ALTER TABLE fileinfo ADD COLUMN IF NOT EXISTS channelid varchar(26);
UPDATE fileinfo SET channelid = posts.channelid FROM posts WHERE fileinfo.channelid IS NULL AND fileinfo.postid = posts.id;
CREATE INDEX IF NOT EXISTS idx_fileinfo_channel_id_create_at ON fileinfo(channelid, createat);
