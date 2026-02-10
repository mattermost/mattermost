CREATE TABLE IF NOT EXISTS PageContents (
    PageId VARCHAR(26) NOT NULL,
    UserId VARCHAR(26) NOT NULL DEFAULT '',
    Content JSONB NOT NULL,
    SearchText TEXT,
    BaseUpdateAt BIGINT,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    DeleteAt BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (PageId, UserId)
);

-- Ensure only one published row per page (UserId = '' means published)
CREATE UNIQUE INDEX idx_pagecontents_published_unique ON PageContents(PageId) WHERE UserId = '';

-- Query indexes
CREATE INDEX idx_pagecontents_updateat ON PageContents (UpdateAt);
CREATE INDEX idx_pagecontents_deleteat ON PageContents (DeleteAt);
CREATE INDEX idx_pagecontents_pageid_deleteat ON PageContents (PageId, DeleteAt);
CREATE INDEX idx_pagecontents_userid_drafts ON PageContents (UserId) WHERE UserId != '';

-- Full-text search index for page content
CREATE INDEX idx_pagecontents_searchtext_gin ON PageContents USING GIN (to_tsvector('english', SearchText));
