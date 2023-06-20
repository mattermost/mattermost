DO
$$
BEGIN
  IF NOT EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'channel_type') THEN
    CREATE TYPE channel_type AS ENUM ('P', 'G', 'O', 'D');
  END IF;
END;
$$
LANGUAGE plpgsql;

ALTER TABLE channels alter column type type channel_type using type::channel_type;

DO
$$
BEGIN
  IF NOT EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'team_type') THEN
    CREATE TYPE team_type AS ENUM ('I', 'O');
  END IF;
END;
$$
LANGUAGE plpgsql;

ALTER TABLE teams alter column type type team_type using type::team_type;

DO
$$
BEGIN
  IF NOT EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'upload_session_type') THEN
    CREATE TYPE upload_session_type AS ENUM ('attachment', 'import');
  END IF;
END;
$$
LANGUAGE plpgsql;

ALTER TABLE uploadsessions alter column type type upload_session_type using type::upload_session_type;
