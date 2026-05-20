ALTER TABLE channels alter column type type varchar(1);

DO
$$
BEGIN
  IF EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'channel_type') THEN
    DROP TYPE channel_type;
  END IF;
END;
$$
LANGUAGE plpgsql;

ALTER TABLE teams alter column type type varchar(255);

DO
$$
BEGIN
  IF EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'team_type') THEN
    DROP TYPE team_type;
  END IF;
END;
$$
LANGUAGE plpgsql;

ALTER TABLE uploadsessions alter column type type varchar(32);

DO
$$
BEGIN
  IF EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'upload_session_type') THEN
    DROP TYPE upload_session_type;
  END IF;
END;
$$
LANGUAGE plpgsql;
