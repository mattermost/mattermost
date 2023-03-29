CREATE TABLE IF NOT EXISTS CommandWebhooks (
    Id varchar(26) NOT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    CommandId varchar(26) DEFAULT NULL,
    UserId varchar(26) DEFAULT NULL,
    ChannelId varchar(26) DEFAULT NULL,
    RootId varchar(26) DEFAULT NULL,
    ParentId varchar(26) DEFAULT NULL,
    UseCount integer DEFAULT NULL,
    PRIMARY KEY (Id),
    KEY idx_command_webhook_create_at (CreateAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
