CREATE TABLE IF NOT EXISTS SharedChannelAttachments (
  Id varchar(26) NOT NULL,
  FileId varchar(26) DEFAULT NULL,
  RemoteId varchar(26) DEFAULT NULL,
  CreateAt bigint(20) DEFAULT NULL,
  LastSyncAt bigint(20) DEFAULT NULL,
  PRIMARY KEY (Id),
  UNIQUE KEY FileId (FileId,RemoteId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
