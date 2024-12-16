CREATE TABLE IF NOT EXISTS PropertyValues (
	ID varchar(26) PRIMARY KEY,
	TargetID varchar(255) NOT NULL,
	TargetType varchar(255) NOT NULL,
	GroupID varchar(26) NOT NULL,
	FieldID varchar(26) NOT NULL,
	Value jsonb NOT NULL,
	CreateAt bigint,
	UpdateAt bigint,
	DeleteAt bigint,
	UNIQUE(GroupID, TargetID, FieldID)
);

CREATE INDEX IF NOT EXISTS idx_propertyvalues_targetid_groupid ON PropertyValues (TargetID, GroupID);
CREATE INDEX IF NOT EXISTS idx_propertyvalues_groupid_targetid ON PropertyValues (GroupID, TargetID);
