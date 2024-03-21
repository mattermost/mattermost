DO
$$
BEGIN
  IF NOT EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'channel_bookmark_type') THEN
    CREATE TYPE channel_bookmark_type AS ENUM ('link', 'file');
  END IF;
END;
$$
LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS channelbookmarks (
    id varchar(26) PRIMARY KEY,
    ownerid varchar(26) NOT NULL,
    channelid varchar(26) NOT NULL,
    fileinfoid varchar(26) DEFAULT NULL,
    createat bigint DEFAULT 0,
    updateat bigint DEFAULT 0,
    deleteat bigint DEFAULT 0,
    displayname text DEFAULT '',
    sortorder integer DEFAULT 0,
    linkurl text DEFAULT NULL,
    imageurl text DEFAULT NULL,
    emoji varchar(64) DEFAULT NULL,
    type channel_bookmark_type DEFAULT 'link',
    originalid varchar(26) DEFAULT NULL,
    parentid varchar(26) DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_channelbookmarks_channelid ON channelbookmarks (channelid);
CREATE INDEX IF NOT EXISTS idx_channelbookmarks_update_at ON channelbookmarks (updateat);
CREATE INDEX IF NOT EXISTS idx_channelbookmarks_delete_at ON channelbookmarks (deleteat);
