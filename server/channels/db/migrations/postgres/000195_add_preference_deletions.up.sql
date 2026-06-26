CREATE TABLE IF NOT EXISTS PreferenceDeletions (
    UserId    VARCHAR(26) NOT NULL,
    Category  VARCHAR(32) NOT NULL,
    Name      VARCHAR(32) NOT NULL,
    DeleteAt  BIGINT      NOT NULL,
    PRIMARY KEY (UserId, Category, Name)
);

CREATE INDEX IF NOT EXISTS idx_preference_deletions_user_deleteat ON PreferenceDeletions (UserId, DeleteAt);
