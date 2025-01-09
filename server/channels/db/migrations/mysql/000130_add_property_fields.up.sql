CREATE TABLE IF NOT EXISTS PropertyFields (
	ID varchar(26) PRIMARY KEY,
	GroupID varchar(26) NOT NULL,
	Name varchar(255) NOT NULL,
	Type enum('text', 'select', 'multiselect', 'date', 'user', 'multiuser'),
	Attrs json,
	TargetID varchar(255),
	TargetType varchar(255),
	CreateAt bigint(20),
	UpdateAt bigint(20),
	DeleteAt bigint(20),
	UNIQUE(GroupID, TargetID, Name, DeleteAt)
);
