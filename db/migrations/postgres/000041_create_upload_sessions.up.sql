CREATE TABLE IF NOT EXISTS uploadsessions (
    id VARCHAR(26) PRIMARY KEY,
    type VARCHAR(32),
    createat bigint,
    userid VARCHAR(26),
    channelid VARCHAR(26),
    filename VARCHAR(256),
    path VARCHAR(512),
    filesize bigint,
    fileoffset bigint
);

CREATE INDEX IF NOT EXISTS idx_uploadsessions_user_id ON uploadsessions(userid);
CREATE INDEX IF NOT EXISTS idx_uploadsessions_create_at ON uploadsessions(createat);
CREATE INDEX IF NOT EXISTS idx_uploadsessions_type ON uploadsessions(type);

ALTER TABLE uploadsessions ADD COLUMN IF NOT EXISTS remoteid VARCHAR(26);
ALTER TABLE uploadsessions ADD COLUMN IF NOT EXISTS reqfileid VARCHAR(26);

DO $$
	<< shared_channel_support >>
BEGIN
	IF((
		SELECT
			value
		FROM systems
	WHERE
		Name = 'Version') = '5.34.0') THEN
           UPDATE UploadSessions SET RemoteId='', ReqFileId='' WHERE RemoteId IS NULL;
	END IF;
END shared_channel_support
$$;
