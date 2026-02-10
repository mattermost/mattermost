#!/bin/sh
# Generates a starter mise config with Mattermost dev env vars.
# Called by `make init-cli-tools` and `make edit-config`.

set -e

# Determine the global mise config path
MISE_GLOBAL_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/mise"
MISE_GLOBAL_CONFIG="$MISE_GLOBAL_DIR/config.toml"

echo ""
echo "Where should the mise config be placed?"
echo ""
echo "  1) Project-level: ./mise.toml (recommended for per-project settings)"
echo "  2) Global:        $MISE_GLOBAL_CONFIG (shared across all projects)"
echo ""
printf "Choice [1]: "
read -r choice

case "$choice" in
    2)
        TARGET="$MISE_GLOBAL_CONFIG"
        mkdir -p "$MISE_GLOBAL_DIR"
        echo "==> Writing to $TARGET"
        ;;
    *)
        TARGET="mise.toml"
        echo "==> Writing to $TARGET"
        ;;
esac

cat > "$TARGET" <<'EOF'
[settings]
idiomatic_version_file_enable_tools = ["node", "python", "go", "java", "ruby", "rust"]

[env]
#ENABLED_DOCKER_SERVICES="postgres inbucket redis minio keycloak openldap prometheus loki grafana promtail"
ENABLED_DOCKER_SERVICES="postgres redis"

MM_DEBUG=1
MM_LOGSETTINGS_CONSOLEJSON="false"
MM_LOGSETTINGS_ENABLECOLOR="true"
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

echo "==> Config written to $TARGET"
