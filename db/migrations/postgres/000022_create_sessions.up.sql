CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(26) PRIMARY KEY,
    token VARCHAR(26),
    createat bigint,
    expiresat bigint,
    lastactivityat bigint,
    userid VARCHAR(26),
    deviceid VARCHAR(512),
    roles VARCHAR(64),
    isoauth boolean,
    props VARCHAR(1000)
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expirednotify boolean;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (userid);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expiresat);
CREATE INDEX IF NOT EXISTS idx_sessions_create_at ON sessions (createat);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity_at ON sessions (lastactivityat);

DO $$
	<< migrate_if_version_below_5120 >>
DECLARE
	current_db_version VARCHAR(100) := '';
BEGIN
	SELECT
		value INTO current_db_version
	FROM
		systems
	WHERE
		name = 'Version';
	IF (string_to_array(current_db_version, '.') < string_to_array('5.12.0', '.')) THEN	
        DELETE FROM sessions where expiresat > 3000000000000;
	END IF;
END migrate_if_version_below_5120
$$;
