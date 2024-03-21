DROP INDEX IF EXISTS idx_channelbookmarks_channelid;
DROP INDEX IF EXISTS idx_channelbookmarks_update_at;
DROP INDEX IF EXISTS idx_channelbookmarks_delete_at;

DROP TABLE IF EXISTS channelbookmarks;

DO
$$
BEGIN
  IF EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'channel_bookmark_type') THEN
    DROP TYPE channel_bookmark_type;
  END IF;
END;
$$
LANGUAGE plpgsql;