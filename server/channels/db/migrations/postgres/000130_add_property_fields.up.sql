DO
$$
BEGIN
  IF NOT EXISTS (SELECT * FROM pg_type typ
                            INNER JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
                        WHERE nsp.nspname = current_schema()
                            AND typ.typname = 'property_field_type') THEN
    CREATE TYPE property_field_type AS ENUM (
        'text',
        'select',
        'multiselect',
        'date',
        'user',
        'multiuser'
    );
  END IF;
END;
$$
LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS PropertyFields (
	ID varchar(26) PRIMARY KEY,
	GroupID varchar(26) NOT NULL,
	Name varchar(255) NOT NULL,
	Type property_field_type,
	Attrs jsonb,
	TargetID varchar(255),
	TargetType varchar(255),
	CreateAt bigint,
	UpdateAt bigint,
	DeleteAt bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_propertyfields_unique ON PropertyFields (GroupID, TargetID, Name) WHERE DeleteAt = 0;
