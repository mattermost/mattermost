CREATE TABLE IF NOT EXISTS TeamMembers (
    TeamId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    Roles varchar(64),
    DeleteAt bigint(20),
    PRIMARY KEY (TeamId, UserId),
    KEY idx_teammembers_team_id TeamMembers(TeamId),
    KEY idx_teammembers_user_id TeamMembers(UserId),
    KEY idx_teammembers_delete_at TeamMembers(DeleteAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
