ALTER TABLE publicchannels ADD COLUMN IF NOT EXISTS createat bigint;
UPDATE publicchannels SET createat = (SELECT createat FROM channels WHERE channels.id = publicchannels.id);
CREATE INDEX IF NOT EXISTS idx_publicchannels_create_at ON publicchannels (createat);
