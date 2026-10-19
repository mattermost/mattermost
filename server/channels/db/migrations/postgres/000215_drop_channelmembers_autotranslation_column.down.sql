-- Recreate the deprecated channelmembers autotranslation column, mirroring
-- migration 000147. Prior values are not restorable. The partial index is
-- recreated separately in 000214.
ALTER TABLE channelmembers
    ADD COLUMN IF NOT EXISTS autotranslation boolean NOT NULL DEFAULT false;
