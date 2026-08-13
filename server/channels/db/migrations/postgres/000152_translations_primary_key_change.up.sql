-- Safety: Set objectType to 'post' for any NULL rows (table should be empty)
UPDATE translations SET objectType = 'post' WHERE objectType IS NULL;

-- Make objectType NOT NULL
ALTER TABLE translations ALTER COLUMN objectType SET NOT NULL;

-- Change primary key to include objectType
ALTER TABLE translations DROP CONSTRAINT translations_pkey;
ALTER TABLE translations ADD PRIMARY KEY (objectId, objectType, dstLang);
