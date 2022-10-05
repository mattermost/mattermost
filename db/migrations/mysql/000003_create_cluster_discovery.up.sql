CREATE TABLE IF NOT EXISTS ClusterDiscovery (
    Id varchar(26) NOT NULL,
    Type varchar(64) DEFAULT NULL,
    ClusterName varchar(64) DEFAULT NULL,
    Hostname text,
    GossipPort int(11) DEFAULT NULL,
    Port integer DEFAULT NULL,
    CreateAt bigint(20) DEFAULT NULL,
    LastPingAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
