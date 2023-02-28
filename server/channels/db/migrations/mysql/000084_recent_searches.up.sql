CREATE TABLE IF NOT EXISTS RecentSearches (
    UserId CHAR(26),
    SearchPointer int,
    Query json,
    CreateAt bigint NOT NULL,
    PRIMARY KEY (UserId, SearchPointer)
);