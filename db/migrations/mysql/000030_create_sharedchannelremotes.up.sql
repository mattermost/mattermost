CREATE TABLE IF NOT EXISTS SharedChannelRemotes (
  Id varchar(26) NOT NULL,
  ChannelId varchar(26) NOT NULL,
  Description varchar(64) DEFAULT NULL,
  CreatorId varchar(26) DEFAULT NULL,
  CreateAt bigint(20) DEFAULT NULL,
  UpdateAt bigint(20) DEFAULT NULL,
  IsInviteAccepted tinyint(1) DEFAULT NULL,
  IsInviteConfirmed tinyint(1) DEFAULT NULL,
  RemoteId varchar(26) DEFAULT NULL,
  NextSyncAt bigint(20) DEFAULT NULL,
  PRIMARY KEY (Id, ChannelId),
  UNIQUE KEY ChannelId (ChannelId, RemoteId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
