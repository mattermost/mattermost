CREATE TABLE IF NOT EXISTS PageDraftContents (
    UserId VARCHAR(26) NOT NULL,
    WikiId VARCHAR(26) NOT NULL,
    DraftId VARCHAR(26) NOT NULL,
    Title VARCHAR(255),
    Content JSONB NOT NULL,
    CreateAt BIGINT NOT NULL,
    UpdateAt BIGINT NOT NULL,
    PRIMARY KEY (UserId, WikiId, DraftId)
);

CREATE INDEX idx_pagedraftcontents_wiki_id ON PageDraftContents (WikiId);
CREATE INDEX idx_pagedraftcontents_user_id ON PageDraftContents (UserId);
CREATE INDEX idx_pagedraftcontents_wiki_updateat ON PageDraftContents (WikiId, UpdateAt DESC);
