ALTER TABLE oauthaccessdata ADD COLUMN IF NOT EXISTS audience varchar(512) DEFAULT '';
ALTER TABLE oauthauthdata ADD COLUMN IF NOT EXISTS resource varchar(512) DEFAULT '';
