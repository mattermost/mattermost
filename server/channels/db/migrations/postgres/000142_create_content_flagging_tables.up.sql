CREATE TABLE IF NOT EXISTS ContentFlaggingCommonReviewers (
	UserId VARCHAR(26) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS ContentFlaggingTeamSettings (
	TeamId VARCHAR(26) PRIMARY KEY,
	Enabled BOOLEAN
);

CREATE TABLE IF NOT EXISTS ContentFlaggingTeamReviewers (
	TeamId VARCHAR(26),
	UserId VARCHAR(26),
	PRIMARY KEY (TeamId, UserId)
);
