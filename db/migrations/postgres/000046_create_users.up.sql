CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    username VARCHAR(64) UNIQUE,
    password VARCHAR(128),
    authdata VARCHAR(128) UNIQUE,
    authservice VARCHAR(32),
    email VARCHAR(128) UNIQUE,
    emailverified boolean,
    nickname VARCHAR(64),
    firstname VARCHAR(64),
    lastname VARCHAR(64),
    roles VARCHAR(256),
    allowmarketing boolean,
    props VARCHAR(4000),
    notifyprops VARCHAR(2000),
    lastpasswordupdate bigint,
    lastpictureupdate bigint,
    failedattempts integer,
    locale VARCHAR(5),
    mfaactive boolean,
    mfasecret VARCHAR(128)
);

ALTER TABLE users DROP COLUMN IF EXISTS lastactivityat;
ALTER TABLE users DROP COLUMN IF EXISTS lastpingat;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(256) DEFAULT '{"automaticTimezone":"","manualTimezone":"","useAutomaticTimezone":"true"}';
ALTER TABLE users ALTER COLUMN position TYPE VARCHAR(128);

DO $$
	<< migrate_if_version_below_4100 >>
DECLARE
	current_db_version VARCHAR(100) := '';
BEGIN
	SELECT
		value INTO current_db_version
	FROM
		systems
	WHERE
		name = 'Version';
	IF (string_to_array(current_db_version, '.') < string_to_array('4.10.0', '.')) THEN	
        UPDATE Users SET AuthData=LOWER(AuthData) WHERE AuthService = 'saml';
	END IF;
END migrate_if_version_below_4100
$$;

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND table_schema = current_schema()
    AND column_name = 'roles'
    AND NOT data_type = 'varchar(256)';
IF column_exist THEN
    ALTER TABLE users ALTER COLUMN roles TYPE varchar(256);
END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_update_at ON users (updateat);
CREATE INDEX IF NOT EXISTS idx_users_create_at ON users (createat);
CREATE INDEX IF NOT EXISTS idx_users_delete_at ON users (deleteat);

CREATE INDEX IF NOT EXISTS idx_users_email_lower_textpattern ON users (lower(email) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_lower_textpattern ON users (lower(username) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_nickname_lower_textpattern ON users (lower(nickname) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_firstname_lower_textpattern ON users (lower(firstname) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_lastname_lower_textpattern ON users (lower(lastname) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_users_all_txt ON users USING gin(to_tsvector('english', username || ' ' || firstname || ' ' || lastname || ' ' || nickname || ' ' || email));
CREATE INDEX IF NOT EXISTS idx_users_all_no_full_name_txt ON users USING gin(to_tsvector('english', username || ' ' || nickname || ' ' || email));
CREATE INDEX IF NOT EXISTS idx_users_names_txt ON users USING gin(to_tsvector('english', username || ' ' || firstname || ' ' || lastname || ' ' || nickname));
CREATE INDEX IF NOT EXISTS idx_users_names_no_full_name_txt ON users USING gin(to_tsvector('english', username || ' ' || nickname));

DROP INDEX IF EXISTS idx_users_email_lower;
DROP INDEX IF EXISTS idx_users_username_lower;
DROP INDEX IF EXISTS idx_users_nickname_lower;
DROP INDEX IF EXISTS idx_users_firstname_lower;
DROP INDEX IF EXISTS idx_users_lastname_lower;

ALTER TABLE users ADD COLUMN IF NOT EXISTS remoteid VARCHAR(26);

DROP INDEX IF EXISTS idx_users_email;
