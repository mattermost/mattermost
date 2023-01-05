ALTER TABLE channelmembers ADD COLUMN IF NOT EXISTS lastviewedpinnedpostat BIGINT NOT NULL DEFAULT 0;
