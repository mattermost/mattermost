CREATE TABLE IF NOT EXISTS AccessControlPolicies (
    ID varchar(26) PRIMARY KEY,
    Name varchar(128) NOT NULL,
    Type varchar(128) NOT NULL,
    Active bool NOT NULL,
    CreateAt bigint NOT NULL,
    Revision int NOT NULL,
    Version varchar(8) NOT NULL,
    Data jsonb,
    Props jsonb
);

CREATE TABLE IF NOT EXISTS AccessControlPolicyHistory (
    ID varchar(26) NOT NULL,
    Name varchar(128) NOT NULL,
    Type varchar(128) NOT NULL,
    CreateAt bigint NOT NULL,
    Revision int NOT NULL,
    Version varchar(8) NOT NULL,
    Data jsonb,
    Props jsonb,
    PRIMARY KEY (ID, Revision)
);
