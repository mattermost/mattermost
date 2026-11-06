-- NULL means no rules.
ALTER TABLE PropertyFields ADD COLUMN IF NOT EXISTS bounds jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'property_field_mutability') THEN
    CREATE TYPE property_field_mutability AS ENUM ('write_once', 'set_on_create');
  END IF;
END;
$$
LANGUAGE plpgsql;

-- NULL means mutable.
ALTER TABLE PropertyFields ADD COLUMN IF NOT EXISTS mutability property_field_mutability;
