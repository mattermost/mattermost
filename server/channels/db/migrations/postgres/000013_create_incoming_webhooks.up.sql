CREATE TABLE IF NOT EXISTS incomingwebhooks (
    id VARCHAR(26) PRIMARY KEY,
    createat bigint,
    updateat bigint,
    deleteat bigint,
    userid VARCHAR(26),
    channelid VARCHAR(26),
    teamid VARCHAR(26),
    displayname VARCHAR(64),
    description VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_incoming_webhook_user_id ON incomingwebhooks (userid);
CREATE INDEX IF NOT EXISTS idx_incoming_webhook_team_id ON incomingwebhooks (teamid);
CREATE INDEX IF NOT EXISTS idx_incoming_webhook_update_at ON incomingwebhooks (updateat);
CREATE INDEX IF NOT EXISTS idx_incoming_webhook_create_at ON incomingwebhooks (createat);
CREATE INDEX IF NOT EXISTS idx_incoming_webhook_delete_at ON incomingwebhooks (deleteat);

ALTER TABLE incomingwebhooks ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE incomingwebhooks ADD COLUMN IF NOT EXISTS iconurl VARCHAR(1024);
ALTER TABLE incomingwebhooks ADD COLUMN IF NOT EXISTS channellocked boolean;
ALTER TABLE incomingwebhooks ALTER COLUMN description TYPE VARCHAR(500);

DO $$
<<checks>>
DECLARE
    wrong_usernames_count integer := 0;
    wrong_icon_urls_count integer := 0;
BEGIN
    SELECT COALESCE(
        SUM(
            CASE
            WHEN CHAR_LENGTH(username) > 255 THEN 1
            ELSE 0
            END
        ),
    0) INTO wrong_usernames_count
    FROM incomingwebhooks;

    SELECT COALESCE(
        SUM(
            CASE
            WHEN CHAR_LENGTH(iconurl) > 1024 THEN 1
            ELSE 0
            END
        ),
    0) INTO wrong_icon_urls_count
    FROM incomingwebhooks;

    IF wrong_usernames_count > 0 THEN
        RAISE EXCEPTION 'IncomingWebhooks column Username has data larger that 255 characters';
    END IF;

    IF wrong_icon_urls_count > 0 THEN
            RAISE EXCEPTION 'IncomingWebhooks column IconURL has data larger that 1024 characters';
    END IF;
END checks $$;

DO $$
DECLARE 
    column_exist boolean := false;
BEGIN
SELECT count(*) != 0 INTO column_exist
    FROM information_schema.columns
    WHERE table_name = 'incomingwebhooks'
    AND table_schema = current_schema()
    AND column_name = 'description'
    AND NOT data_type = 'VARCHAR(500)';
IF column_exist THEN
    ALTER TABLE incomingwebhooks ALTER COLUMN description TYPE VARCHAR(500);
END IF;
END $$;
