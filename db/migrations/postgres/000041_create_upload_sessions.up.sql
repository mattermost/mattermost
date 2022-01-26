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
	<< migrate_if_version_below_5350 >>
DECLARE
	current_db_version VARCHAR(100) := '';
BEGIN
	SELECT
		value INTO current_db_version
	FROM
		systems
	WHERE
		name = 'Version';
	IF (string_to_array(current_db_version, '.') < string_to_array('5.35.0', '.')) THEN
		UPDATE UploadSessions SET RemoteId='', ReqFileId='' WHERE RemoteId IS NULL;
	END IF;
END migrate_if_version_below_5350
$$;
