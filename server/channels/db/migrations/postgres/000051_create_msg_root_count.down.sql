ALTER TABLE channelmembers DROP COLUMN IF EXISTS msgcountroot;
ALTER TABLE channelmembers DROP COLUMN IF EXISTS mentioncountroot;
ALTER TABLE channels DROP COLUMN IF EXISTS totalmsgcountroot;
