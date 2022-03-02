CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(26) PRIMARY KEY,
    name VARCHAR(64),
    displayname VARCHAR(128),
    description VARCHAR(1024),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    permissions VARCHAR(4096),
    schememanaged boolean,
    UNIQUE(name)
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS builtin boolean;

DO $$
	<< migrate_if_version_below_500 >>
DECLARE
	current_db_version VARCHAR(100) := '';
BEGIN
	SELECT
		value INTO current_db_version
	FROM
		systems
	WHERE
		name = 'Version';
	IF (string_to_array(current_db_version, '.') < string_to_array('5.0.0', '.')) THEN
		 UPDATE Roles SET SchemeManaged = false
            WHERE Name NOT IN ('system_user', 'system_admin', 'team_user', 'team_admin', 'channel_user', 'channel_admin');
	END IF;
END migrate_if_version_below_500
$$;

ALTER TABLE roles ALTER COLUMN permissions TYPE TEXT;
