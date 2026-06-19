CREATE TABLE IF NOT EXISTS Pages (
    Id                          VARCHAR(26) PRIMARY KEY,
    WikiId                      VARCHAR(26) NOT NULL,
    ChannelId                   VARCHAR(26) NOT NULL,
    ParentId                    VARCHAR(26) NOT NULL DEFAULT '',
    Type                        VARCHAR(26) NOT NULL DEFAULT 'page',
    Title                       VARCHAR(256) NOT NULL DEFAULT '',
    Body                        TEXT NOT NULL DEFAULT '',
    SearchText                  TEXT NOT NULL DEFAULT '',
    UserId                      VARCHAR(26) NOT NULL,
    LastModifiedBy              VARCHAR(26) NOT NULL DEFAULT '',
    SortOrder                   BIGINT NOT NULL DEFAULT 0,
    CreateAt                    BIGINT NOT NULL DEFAULT 0,
    UpdateAt                    BIGINT NOT NULL DEFAULT 0,
    DeleteAt                    BIGINT NOT NULL DEFAULT 0,
    EditAt                      BIGINT NOT NULL DEFAULT 0,
    OriginalId                  VARCHAR(26) NOT NULL DEFAULT '',
    HasEffectiveViewRestriction BOOLEAN NOT NULL DEFAULT false,
    HasLocalEditRestriction     BOOLEAN NOT NULL DEFAULT false,
    Props                       jsonb NOT NULL DEFAULT '{}'::jsonb,
    ReparentedParentOnDelete    VARCHAR(26),
    ReparentedChildrenOnDelete  TEXT
);

-- Child listing: GetPageChildren filters (ParentId, DeleteAt=0) with no ChannelId predicate.
CREATE INDEX IF NOT EXISTS idx_pages_parentid ON Pages (ParentId) WHERE DeleteAt = 0;

-- Sibling-lock query filters (ChannelId, ParentId, DeleteAt=0).
CREATE INDEX IF NOT EXISTS idx_pages_channelid_parentid ON Pages (ChannelId, ParentId) WHERE DeleteAt = 0;

-- List-by-wiki: GetChannelPages keys on (ChannelId, DeleteAt=0). Partial so version
-- snapshots (DeleteAt>0, ~10:1) stay out of the index.
CREATE INDEX IF NOT EXISTS idx_pages_channelid ON Pages (ChannelId) WHERE DeleteAt = 0;

-- Full-text search over Title + SearchText. COALESCE is defensive: Title/SearchText are
-- NOT NULL today, but a bare || would yield NULL (dropping the row from the index) if a
-- future schema change made either column nullable.
CREATE INDEX IF NOT EXISTS idx_pages_search_txt ON Pages
    USING GIN (to_tsvector('english', COALESCE(Title, '') || ' ' || COALESCE(SearchText, '')));

-- Version-history lookup: WHERE OriginalId=pageId AND DeleteAt>0. Partial to snapshot rows only.
CREATE INDEX IF NOT EXISTS idx_pages_originalid ON Pages (OriginalId) WHERE DeleteAt > 0;
