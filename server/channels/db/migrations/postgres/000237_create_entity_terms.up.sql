CREATE TABLE IF NOT EXISTS entitydictionaries (
    typeid varchar(80) PRIMARY KEY,
    pluginid varchar(190) NOT NULL,
    generation bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS entityterms (
    typeid varchar(80) NOT NULL,
    value varchar(32) NOT NULL,
    title varchar(512) NOT NULL,
    url varchar(2048) NOT NULL,
    PRIMARY KEY (typeid, value)
);
