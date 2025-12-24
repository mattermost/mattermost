-- Add WikiId column to Drafts table for wiki page drafts
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS wikiid varchar(26) DEFAULT '';

-- Increase RootId column size to support composite keys (wikiId:draftId format = 26+1+26 = 53 chars)
ALTER TABLE drafts ALTER COLUMN rootid TYPE varchar(60);

-- Add index on WikiId for efficient queries
CREATE INDEX IF NOT EXISTS idx_drafts_wiki_id ON drafts(wikiid);
