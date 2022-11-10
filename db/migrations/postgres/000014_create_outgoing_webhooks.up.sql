CREATE TABLE IF NOT EXISTS outgoingwebhooks (
    id VARCHAR(26) PRIMARY KEY,
    token VARCHAR(26),
    createat bigint,
    updateat bigint,
    deleteat bigint,
    creatorid VARCHAR(26),
    channelid VARCHAR(26),
    teamid VARCHAR(26),
    triggerwords VARCHAR(1024),
    callbackurls VARCHAR(1024),
    displayname VARCHAR(64)
);

ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS contenttype VARCHAR(128);
ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS triggerwhen integer;
ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS username VARCHAR(64);
ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS iconurl VARCHAR(1024);
ALTER TABLE outgoingwebhooks ADD COLUMN IF NOT EXISTS description VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_team_id ON outgoingwebhooks (teamid);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_update_at ON outgoingwebhooks (updateat);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_create_at ON outgoingwebhooks (createat);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_delete_at ON outgoingwebhooks (deleteat);

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'outgoingwebhooks'
    AND table_schema = '{{.SchemaName}}'
    AND column_name = 'description'
    AND NOT data_type = 'VARCHAR(500)';
IF column_exist THEN
    ALTER TABLE outgoingwebhooks ALTER COLUMN description TYPE VARCHAR(500);
END IF;
END $$;

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'outgoingwebhooks'
    AND table_schema = '{{.SchemaName}}'
    AND column_name = 'iconurl'
    AND NOT data_type = 'VARCHAR(1024)';
IF column_exist THEN
    ALTER TABLE outgoingwebhooks ALTER COLUMN iconurl TYPE VARCHAR(1024);
END IF;
END $$;

DO $$
BEGIN
    IF (
        SELECT column_default::bigint
        FROM information_schema.columns
        WHERE table_schema='{{.SchemaName}}'
        AND table_name='outgoingwebhooks'
        AND column_name='username'
    ) = 0 THEN
        ALTER TABLE outgoingwebhooks ALTER COLUMN username SET DEFAULT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF (
        SELECT column_default::bigint
        FROM information_schema.columns
        WHERE table_schema='{{.SchemaName}}'
        AND table_name='outgoingwebhooks'
        AND column_name='iconurl'
    ) = 0 THEN
        ALTER TABLE outgoingwebhooks ALTER COLUMN iconurl SET DEFAULT NULL;
    END IF;
END $$;
