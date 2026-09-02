ALTER TABLE channelbookmarks DROP COLUMN IF EXISTS targetid;
-- NOTE: PostgreSQL cannot remove a value from an ENUM type; the 'board' value remains on rollback.
