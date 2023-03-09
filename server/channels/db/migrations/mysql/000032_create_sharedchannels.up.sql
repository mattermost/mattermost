CREATE TABLE IF NOT EXISTS SharedChannels (
  ChannelId varchar(26) NOT NULL,
  TeamId varchar(26) DEFAULT NULL,
  Home tinyint(1) DEFAULT NULL,
  ReadOnly tinyint(1) DEFAULT NULL,
  ShareName varchar(64) DEFAULT NULL,
  ShareDisplayName varchar(64) DEFAULT NULL,
  SharePurpose varchar(250) DEFAULT NULL,
  ShareHeader text,
  CreatorId varchar(26) DEFAULT NULL,
  CreateAt bigint(20) DEFAULT NULL,
  UpdateAt bigint(20) DEFAULT NULL,
  RemoteId varchar(26) DEFAULT NULL,
  PRIMARY KEY (ChannelId),
  UNIQUE KEY ShareName (ShareName, TeamId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
