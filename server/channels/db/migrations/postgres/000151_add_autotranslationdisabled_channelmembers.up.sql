-- Add autotranslationdisabled column with default false (users have autotranslation enabled by default)
ALTER TABLE channelmembers
    ADD COLUMN IF NOT EXISTS autotranslationdisabled boolean NOT NULL DEFAULT false;
