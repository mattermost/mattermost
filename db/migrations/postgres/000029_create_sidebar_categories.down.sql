ALTER TABLE sidebarcategories DROP COLUMN IF EXISTS collapsed;
ALTER TABLE sidebarcategories DROP COLUMN IF EXISTS muted;
ALTER TABLE sidebarcategories ALTER COLUMN id TYPE VARCHAR(26);

DROP TABLE IF EXISTS sidebarcategories;
