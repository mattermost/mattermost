CREATE TABLE IF NOT EXISTS PluginAccessControlUsers (
    PluginId varchar(190) NOT NULL,
    UserId varchar(26) NOT NULL,
    CreateAt bigint NOT NULL,
    PRIMARY KEY (PluginId, UserId)
);
