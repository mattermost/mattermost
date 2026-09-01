CREATE TABLE IF NOT EXISTS PluginPermissions (
    PluginId         VARCHAR(190)  NOT NULL,
    LocalId          VARCHAR(64)   NOT NULL,
    PermissionId     VARCHAR(255)  NOT NULL,
    Name             VARCHAR(128)  NOT NULL,
    Description      VARCHAR(1024) NOT NULL DEFAULT '',
    Scope            VARCHAR(32)   NOT NULL,
    DefaultRoles     TEXT          NOT NULL DEFAULT '',
    Active           BOOLEAN       NOT NULL DEFAULT TRUE,
    DefaultsApplied  BOOLEAN       NOT NULL DEFAULT FALSE,
    CreateAt         BIGINT        NOT NULL,
    UpdateAt         BIGINT        NOT NULL,
    PRIMARY KEY (PluginId, LocalId)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pluginpermissions_permissionid ON PluginPermissions (PermissionId);

CREATE TABLE IF NOT EXISTS PluginRoles (
    PluginId  VARCHAR(190) NOT NULL,
    LocalName VARCHAR(32)  NOT NULL,
    RoleName  VARCHAR(64)  NOT NULL,
    CreateAt  BIGINT       NOT NULL,
    PRIMARY KEY (PluginId, LocalName)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pluginroles_rolename ON PluginRoles (RoleName);
