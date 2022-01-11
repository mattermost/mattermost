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
	<< migrate_roles >>
BEGIN
	IF((
		SELECT
			value
		FROM systems
	WHERE
		Name = 'Version') = '4.10.0') THEN
            UPDATE Roles SET SchemeManaged = false
            WHERE Name NOT IN ('system_user', 'system_admin', 'team_user', 'team_admin', 'channel_user', 'channel_admin');
	END IF;
END migrate_roles
$$;

ALTER TABLE roles ALTER COLUMN permissions TYPE TEXT;
