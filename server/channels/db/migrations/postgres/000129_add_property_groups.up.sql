CREATE TABLE IF NOT EXISTS PropertyGroups (
	ID varchar(26) PRIMARY KEY,
	Name varchar(64) NOT NULL,
	UNIQUE(Name)
);
