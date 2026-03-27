-- Drop the state index
DROP INDEX IF EXISTS idx_translations_state;

-- Remove the state column
ALTER TABLE translations DROP COLUMN IF EXISTS state;

