CREATE TABLE IF NOT EXISTS ChannelGuards (
    ChannelId varchar(26)  NOT NULL,
    PluginId  varchar(190) NOT NULL,
    CreatedAt bigint       NOT NULL,
    PRIMARY KEY (ChannelId, PluginId)
);
