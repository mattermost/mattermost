ALTER TABLE channelmembers
  ADD COLUMN IF NOT EXISTS sourceid VARCHAR(26) NOT NULL DEFAULT '';

DO
$$
BEGIN
  IF NOT EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'channel_link_source_type') THEN
    CREATE TYPE channel_link_source_type AS ENUM ('channel', 'group');
  END IF;
END;
$$
LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS channelmemberlinks (
  sourceid VARCHAR(26) NOT NULL,
  sourcetype channel_link_source_type NOT NULL,
  destinationid VARCHAR(26) NOT NULL,
  createat BIGINT NOT NULL,
  PRIMARY KEY (sourceid, sourcetype, destinationid)
);

CREATE INDEX IF NOT EXISTS idx_channelmemberlinks_destination
  ON channelmemberlinks(destinationid);

CREATE INDEX IF NOT EXISTS idx_channelmemberlinks_source
  ON channelmemberlinks(sourceid);
