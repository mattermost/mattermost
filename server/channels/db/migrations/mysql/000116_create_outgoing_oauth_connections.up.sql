CREATE TABLE IF NOT EXISTS OutgoingOAuthConnections (
    Id varchar(26),
    Name varchar(64),
    CreatorId varchar(26) DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    UpdateAt bigint(20) DEFAULT NULL,
    ClientId varchar(255),
    ClientSecret varchar(255),
    CredentialsUsername varchar(255),
    CredentialsPassword varchar(255),
    OAuthTokenURL text,
    GrantType varchar(32) DEFAULT 'client_credentials',
    Audiences TEXT,
    PRIMARY KEY (Id),
    KEY idx_OutgoingOAuthConnections_name (Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
