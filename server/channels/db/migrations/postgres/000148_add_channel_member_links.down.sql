DROP TABLE IF EXISTS channelmemberlinks;

DO
$$
BEGIN
  IF EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'channel_link_source_type') THEN
    DROP TYPE channel_link_source_type;
  END IF;
END;
$$
LANGUAGE plpgsql;

ALTER TABLE channelmembers DROP COLUMN IF EXISTS sourceid;
