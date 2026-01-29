DROP INDEX IF EXISTS idx_pagecontents_searchtext_gin;
DROP INDEX IF EXISTS idx_pagecontents_userid_drafts;
DROP INDEX IF EXISTS idx_pagecontents_wikiid;
DROP INDEX IF EXISTS idx_pagecontents_pageid_deleteat;
DROP INDEX IF EXISTS idx_pagecontents_deleteat;
DROP INDEX IF EXISTS idx_pagecontents_updateat;
DROP INDEX IF EXISTS idx_pagecontents_published_unique;
DROP TABLE IF EXISTS PageContents;
