CREATE TABLE IF NOT EXISTS SearchBookmarks (
  id VARCHAR(26) PRIMARY KEY,
	userID VARCHAR(26),
	title TEXT,
  teamid VARCHAR(26),
	terms TEXT,
  searchType VARCHAR(26)
);
