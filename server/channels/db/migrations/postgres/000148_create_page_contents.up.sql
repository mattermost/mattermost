CREATE TABLE IF NOT EXISTS PageContents (
    PageId VARCHAR(26) PRIMARY KEY,
    Content JSONB NOT NULL,
    SearchText TEXT,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    CONSTRAINT fk_pagecontents_posts FOREIGN KEY (PageId)
        REFERENCES Posts(Id) ON DELETE CASCADE
);

CREATE INDEX idx_pagecontents_updateat ON PageContents (UpdateAt);

-- Full-text search index for page content
CREATE INDEX idx_pagecontents_searchtext_gin ON PageContents USING GIN (to_tsvector('english', SearchText));
