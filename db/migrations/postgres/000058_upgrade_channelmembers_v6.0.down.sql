CREATE INDEX IF NOT EXISTS idx_channelmembers_user_id ON channelmembers(userid);

DROP INDEX IF EXISTS idx_channelmembers_channel_id_scheme_guest_user_id;
DROP INDEX IF EXISTS idx_channelmembers_user_id_channel_id_last_viewed_at;

ALTER TABLE channelmembers ALTER COLUMN notifyprops TYPE varchar(2000);
