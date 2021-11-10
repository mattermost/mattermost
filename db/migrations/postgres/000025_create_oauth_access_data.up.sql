CREATE TABLE IF NOT EXISTS oauthaccessdata (
    token VARCHAR(26) NOT NULL,
    refreshtoken VARCHAR(26),
    redirecturi VARCHAR(256),
    PRIMARY KEY (token)
);

CREATE INDEX IF NOT EXISTS idx_oauthaccessdata_refresh_token ON oauthaccessdata (refreshtoken);

ALTER TABLE oauthaccessdata ADD COLUMN IF NOT EXISTS clientid VARCHAR(26);

ALTER TABLE oauthaccessdata ADD COLUMN IF NOT EXISTS userid VARCHAR(26);
CREATE INDEX IF NOT EXISTS idx_oauthaccessdata_user_id ON oauthaccessdata (userid);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT conname
        FROM pg_constraint
        WHERE conname = 'oauthaccessdata_clientid_userid_key'
    )
    THEN
        ALTER TABLE oauthaccessdata ADD CONSTRAINT oauthaccessdata_clientid_userid_key UNIQUE (clientid, userid);
    END IF;
END $$;

ALTER TABLE oauthaccessdata ADD COLUMN IF NOT EXISTS expiresat bigint;

DROP INDEX IF EXISTS idx_oauthaccessdata_auth_code;
ALTER TABLE oauthaccessdata DROP COLUMN IF EXISTS authcode;

ALTER TABLE oauthaccessdata ADD COLUMN IF NOT EXISTS scope VARCHAR(128);

DROP INDEX IF EXISTS clientid_2;

DROP INDEX IF EXISTS idx_oauthaccessdata_client_id;
