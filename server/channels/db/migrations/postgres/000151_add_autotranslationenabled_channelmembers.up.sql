-- Add autotranslationenabled column with default true (opt-out instead of opt-in)
ALTER TABLE channelmembers
    ADD COLUMN IF NOT EXISTS autotranslationenabled boolean NOT NULL DEFAULT true;
