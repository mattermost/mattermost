CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    displayname VARCHAR(64),
    name VARCHAR(64),
    description VARCHAR(255),
    email VARCHAR(128),
    type VARCHAR(255),
    companyname VARCHAR(64),
    alloweddomains VARCHAR(1000),
    inviteid VARCHAR(32),
    schemeid VARCHAR(26),
    UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_teams_invite_id ON teams (inviteid);
CREATE INDEX IF NOT EXISTS idx_teams_update_at ON teams (updateat);
CREATE INDEX IF NOT EXISTS idx_teams_create_at ON teams (createat);
CREATE INDEX IF NOT EXISTS idx_teams_delete_at ON teams (deleteat);
CREATE INDEX IF NOT EXISTS idx_teams_scheme_id ON teams (schemeid);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS allowopeninvite boolean;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lastteamiconupdate bigint;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description VARCHAR(255);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS groupconstrained boolean;

DROP INDEX IF EXISTS idx_teams_name;

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'teams'
    AND column_name = 'alloweddomains'
    AND NOT data_type = 'varchar(1000)';
IF column_exist THEN
    ALTER TABLE teams ALTER COLUMN alloweddomains TYPE VARCHAR(1000);
END IF;
END $$;

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'teams'
    AND column_name = 'groupconstrained'
    AND NOT data_type = 'boolean';
IF column_exist THEN
    ALTER TABLE teams ALTER COLUMN groupconstrained TYPE boolean;
END IF;
END $$;

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'teams'
    AND column_name = 'type'
    AND NOT data_type = 'varchar(255)';
IF column_exist THEN
    ALTER TABLE teams ALTER COLUMN type TYPE VARCHAR(255);
END IF;
END $$;

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'teams'
    AND column_name = 'schemeid'
    AND NOT data_type = 'varchar(26)';
IF column_exist THEN
    ALTER TABLE teams ALTER COLUMN schemeid TYPE varchar(26);
END IF;
END $$;
