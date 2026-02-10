#!/bin/sh
# Generates a starter mise.toml in the repo root.
# Called by `make init-cli-tools`.

cat > mise.toml <<'EOF'
[settings]
idiomatic_version_file_enable_tools = ["node", "python", "go", "java", "ruby", "rust"]

[env]
#ENABLED_DOCKER_SERVICES="postgres inbucket redis minio keycloak openldap prometheus loki grafana promtail"
ENABLED_DOCKER_SERVICES="postgres redis"

MM_DEBUG=1
RUN_SERVER_IN_BACKGROUND="false"

MM_SERVICESETTINGS_ENABLELOCALMODE="true"
MM_SERVICESETTINGS_ENABLETESTING="true"
MM_SERVICESETTINGS_ENABLEDEVELOPER="true"

MM_ADMIN_USERNAME="sysadmin"
MM_ADMIN_PASSWORD="Sys@dmin-sample1"

MM_SERVICESETTINGS_Forward80To443="false"
MM_SERVICESETTINGS_UseLetsEncrypt="false"

MM_SERVICESETTINGS_SITEURL="http://localhost:8065"
#MM_SERVICESETTINGS_SITEURL="https://mattermost.localhost"

MM_PLUGINSETTINGS_ENABLEUPLOADS="true"
MM_FILESETTINGS_MAXFILESIZE="1073741824"

#MM_FEATUREFLAGS_ExperimentalCrossTeamSearch="true"
EOF
