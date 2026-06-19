-- Page reactions live in their own table, not as a column on the shared Reactions table.
-- Natural PK gives per-owner uniqueness at creation; no surrogate id, no REPLICA IDENTITY
-- concern. No DeleteAt: page reactions are hard-deleted and never cross-cluster synced.
CREATE TABLE IF NOT EXISTS PageReactions (
    PageId    VARCHAR(26) NOT NULL,
    UserId    VARCHAR(26) NOT NULL,
    EmojiName VARCHAR(64) NOT NULL,
    CreateAt  BIGINT NOT NULL DEFAULT 0,
    ChannelId VARCHAR(26) NOT NULL DEFAULT '',
    RemoteId  VARCHAR(26) NOT NULL DEFAULT '',
    PRIMARY KEY (PageId, UserId, EmojiName)
);

-- The natural PK is PageId-leading, so it cannot serve PermanentDeleteByUser's
-- WHERE UserId = ? (user/account deletion). Index UserId to avoid a full table scan.
CREATE INDEX IF NOT EXISTS idx_pagereactions_userid ON PageReactions (UserId);
