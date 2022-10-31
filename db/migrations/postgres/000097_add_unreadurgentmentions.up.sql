ALTER TABLE channelmembers ADD COLUMN IF NOT EXISTS urgentmentioncount bigint DEFAULT '0'::bigint;

ALTER TABLE threads ADD COLUMN IF NOT EXISTS isurgent boolean DEFAULT false;
