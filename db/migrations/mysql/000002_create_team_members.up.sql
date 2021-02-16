CREATE TABLE IF NOT EXISTS TeamMembers (
    TeamId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    Roles varchar(64),
    DeleteAt bigint(20),
    SchemeUser tinyint(4),
    SchemeAdmin tinyint(4),
    SchemeGuest tinyint(4),
    PRIMARY KEY (TeamId, UserId),
    KEY idx_teammembers_team_id (TeamId),
    KEY idx_teammembers_user_id (UserId),
    KEY idx_teammembers_delete_at (DeleteAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
