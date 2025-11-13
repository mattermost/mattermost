CREATE TABLE IF NOT EXISTS PageDrafts (
    UserId VARCHAR(26) NOT NULL,
    WikiId VARCHAR(26) NOT NULL,
    DraftId VARCHAR(26) NOT NULL,
    Title VARCHAR(255),
    Content JSONB NOT NULL,
    FileIds TEXT,
    Props JSONB,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    PRIMARY KEY (UserId, WikiId, DraftId)
);

CREATE INDEX idx_pagedrafts_wiki_id ON PageDrafts (WikiId);
CREATE INDEX idx_pagedrafts_user_id ON PageDrafts (UserId);
CREATE INDEX idx_pagedrafts_wiki_updateat ON PageDrafts (WikiId, UpdateAt DESC);
