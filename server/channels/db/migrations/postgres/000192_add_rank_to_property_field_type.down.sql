-- Postgres cannot remove a value from an existing enum in place, so rebuild
-- the type without 'rank'. Any rows still holding 'rank' (e.g. fields created
-- via the property API after this migration ran) are coerced to 'select'
-- first so the recreated enum can accept them; 'select' has the same storage
-- shape (single option ID).

UPDATE PropertyFields SET Type = 'select' WHERE Type = 'rank';

ALTER TYPE property_field_type RENAME TO property_field_type_old;

CREATE TYPE property_field_type AS ENUM (
    'text',
    'select',
    'multiselect',
    'date',
    'user',
    'multiuser'
);

ALTER TABLE PropertyFields
    ALTER COLUMN Type TYPE property_field_type USING Type::text::property_field_type;

DROP TYPE property_field_type_old;
