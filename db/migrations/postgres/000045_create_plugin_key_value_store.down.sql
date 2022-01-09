DO $$BEGIN
    IF (
        SELECT column_default::bigint
        FROM information_schema.columns
        WHERE table_schema='public'
        AND table_name='pluginkeyvaluestore'
        AND column_name='expireat'
    ) IS NULL THEN
        ALTER TABLE pluginkeyvaluestore ALTER COLUMN expireat SET DEFAULT 0;
    END IF;
END$$;

ALTER TABLE pluginkeyvaluestore DROP COLUMN IF EXISTS expireat;

DROP TABLE IF EXISTS pluginkeyvaluestore;
