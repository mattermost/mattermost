-- Drop the state index
-- nolint:concurrentIndex
DROP INDEX IF EXISTS idx_translations_state;

-- Remove the state column
ALTER TABLE translations DROP COLUMN IF EXISTS state;

