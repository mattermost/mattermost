ALTER TABLE channelmembers ALTER COLUMN notifyprops TYPE jsonb USING notifyprops::jsonb;

CREATE INDEX IF NOT EXISTS idx_channelmembers_user_id_channel_id_last_viewed_at ON channelmembers(userid, channelid, lastviewedat);
CREATE INDEX IF NOT EXISTS idx_channelmembers_channel_id_scheme_guest_user_id ON channelmembers(channelid, schemeguest, userid);

DROP INDEX IF EXISTS idx_channelmembers_user_id;
