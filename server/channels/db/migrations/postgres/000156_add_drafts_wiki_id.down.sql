-- Remove WikiId index
DROP INDEX IF EXISTS idx_drafts_wiki_id;

-- Restore RootId column to original size
ALTER TABLE drafts ALTER COLUMN rootid TYPE varchar(26);

-- Remove WikiId column from Drafts table
ALTER TABLE drafts DROP COLUMN IF EXISTS wikiid;
