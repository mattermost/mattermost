-- Add new autotranslationdisabled column (opt-out semantics)
-- Default false means autotranslation is ENABLED by default
ALTER TABLE channelmembers
    ADD COLUMN IF NOT EXISTS autotranslationdisabled boolean NOT NULL DEFAULT false;
