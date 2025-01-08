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

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PropertyFields'
        AND table_schema = DATABASE()
        AND index_name = 'idx_propertyfields_groupid_targetid'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_propertyfields_groupid_targetid ON PropertyFields (GroupID, TargetID);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
