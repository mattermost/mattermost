-- Drop the deprecated channelmembers autotranslation column (opt-in semantics),
-- replaced by autotranslationdisabled (opt-out) in migration 000151. The partial
-- index on this column is dropped separately in 000212.
ALTER TABLE channelmembers
    DROP COLUMN IF EXISTS autotranslation;
