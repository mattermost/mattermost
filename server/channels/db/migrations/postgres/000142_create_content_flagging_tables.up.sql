CREATE TABLE IF NOT EXISTS ContentFlaggingCommonReviewers (
	userid VARCHAR(26) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS ContentFlaggingTeamSettings (
	teamid VARCHAR(26) PRIMARY KEY,
	enabled BOOLEAN
);

CREATE TABLE IF NOT EXISTS ContentFlaggingTeamReviewers (
	teamid VARCHAR(26),
	userid VARCHAR(26),
	PRIMARY KEY (teamid, userid)
);
