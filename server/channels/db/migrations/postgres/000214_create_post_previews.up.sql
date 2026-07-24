CREATE TABLE IF NOT EXISTS PostPreviews (
    PostId            VARCHAR(26) NOT NULL,
    PreviewedInPostId VARCHAR(26) NOT NULL,
    UNIQUE (PostId, PreviewedInPostId)
);
