-- Revert primary key (WARNING: will fail if duplicate objectId+dstLang exist)
ALTER TABLE translations DROP CONSTRAINT translations_pkey;
ALTER TABLE translations ADD PRIMARY KEY (objectId, dstLang);

-- Allow NULL objectType again
ALTER TABLE translations ALTER COLUMN objectType DROP NOT NULL;
