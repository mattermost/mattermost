CREATE TABLE IF NOT EXISTS pluginkeyvaluestore (
    pluginid VARCHAR(190) NOT NULL,
    pkey VARCHAR(50) NOT NULL,
    pvalue bytea,
    PRIMARY KEY (pluginid, pkey)
);

ALTER TABLE pluginkeyvaluestore ADD COLUMN IF NOT EXISTS expireat bigint DEFAULT 0;

DO $$BEGIN
    IF (
        SELECT column_default::bigint
        FROM information_schema.columns
        WHERE table_schema='public'
        AND table_name='pluginkeyvaluestore'
        AND column_name='expireat'
    ) = 0 THEN
        ALTER TABLE pluginkeyvaluestore ALTER COLUMN expireat SET DEFAULT NULL;
    END IF;
END$$;
