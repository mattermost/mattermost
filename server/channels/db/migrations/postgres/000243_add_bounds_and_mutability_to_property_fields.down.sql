ALTER TABLE PropertyFields DROP COLUMN IF EXISTS mutability;

ALTER TABLE PropertyFields DROP COLUMN IF EXISTS bounds;

DROP TYPE IF EXISTS property_field_mutability;
