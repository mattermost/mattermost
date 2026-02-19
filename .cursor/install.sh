#!/usr/bin/env bash
set -euo pipefail

# ============================================
# PATH setup
# Docker ENV vars may not carry through to the
# shell when Cursor runs install scripts.
# Explicitly ensure Go, Node, and GOPATH/bin
# are on PATH.
# ============================================
export GOPATH="${GOPATH:-/home/ubuntu/go}"
export PATH="/usr/local/go/bin:${GOPATH}/bin:/usr/local/bin:${PATH}"

echo ">>> Mattermost Cursor Agent: install.sh"
echo ">>> Working directory: $(pwd)"
echo ">>> User: $(whoami)"
echo ">>> Go version: $(go version)"
echo ">>> Node version: $(node --version)"
echo ">>> npm version: $(npm --version)"

WORKSPACE_ROOT="$(pwd)"

# ============================================
# Enterprise repo
# Clone is enabled by default.
#
# To disable enterprise clone explicitly:
#   MM_CLONE_ENTERPRISE=false bash .cursor/install.sh
#
# Optional override for clone path:
#   MM_ENTERPRISE_DIR=/some/path/enterprise
# The default remains ../enterprise relative to the
# repo root to match server/Makefile expectations.
# ============================================
MM_CLONE_ENTERPRISE="${MM_CLONE_ENTERPRISE:-true}"
ENTERPRISE_DIR="${MM_ENTERPRISE_DIR:-${WORKSPACE_ROOT}/../enterprise}"
ENTERPRISE_PARENT_DIR="$(dirname "${ENTERPRISE_DIR}")"

if [ -n "${MM_ENTERPRISE_DIR:-}" ]; then
    export BUILD_ENTERPRISE_DIR="${ENTERPRISE_DIR}"
    echo ">>> Using custom BUILD_ENTERPRISE_DIR=${BUILD_ENTERPRISE_DIR}"
fi

if [ "${MM_CLONE_ENTERPRISE}" = "true" ]; then
    if [ -d "${ENTERPRISE_DIR}/.git" ]; then
        echo ">>> Enterprise repo already exists at ${ENTERPRISE_DIR}, pulling latest..."
        cd "${ENTERPRISE_DIR}" && git pull
    else
        if [ ! -d "${ENTERPRISE_DIR}" ] && { [ ! -d "${ENTERPRISE_PARENT_DIR}" ] || [ ! -w "${ENTERPRISE_PARENT_DIR}" ]; }; then
            if command -v sudo &>/dev/null; then
                echo ">>> Parent dir is not writable (${ENTERPRISE_PARENT_DIR}), preparing ${ENTERPRISE_DIR} with sudo..."
                sudo mkdir -p "${ENTERPRISE_DIR}"
                sudo chown "$(id -u)":"$(id -g)" "${ENTERPRISE_DIR}"
            else
                echo ">>> ERROR: Cannot create ${ENTERPRISE_DIR} (parent not writable and sudo unavailable)."
                exit 1
            fi
        fi

        if [ -d "${ENTERPRISE_DIR}" ] && [ ! -w "${ENTERPRISE_DIR}" ]; then
            if command -v sudo &>/dev/null; then
                echo ">>> Enterprise dir is not writable, fixing ownership with sudo..."
                sudo chown -R "$(id -u)":"$(id -g)" "${ENTERPRISE_DIR}"
            else
                echo ">>> ERROR: ${ENTERPRISE_DIR} exists but is not writable and sudo is unavailable."
                exit 1
            fi
        fi

        echo ">>> Cloning mattermost/enterprise..."
        git clone git@github.com:mattermost/enterprise.git "${ENTERPRISE_DIR}"
        echo ">>> Enterprise repo cloned to ${ENTERPRISE_DIR}"
    fi
else
    echo ">>> Skipping enterprise clone (MM_CLONE_ENTERPRISE=false)."
fi

# ============================================
# Go workspace setup
# The go.work file is gitignored, so we need
# to create it before downloading modules.
# ============================================
echo ">>> Setting up Go workspace..."
cd "${WORKSPACE_ROOT}/server"
make setup-go-work

# ============================================
# Go dependencies
# Download modules for both server and public.
# ============================================
echo ">>> Downloading Go modules..."
cd "${WORKSPACE_ROOT}/server"
go mod download

cd "${WORKSPACE_ROOT}/server/public"
go mod download

# ============================================
# Go tools
# ============================================
echo ">>> Installing Go tools..."
go install github.com/vektra/mockery/v2@v2.53.4
go install gotest.tools/gotestsum@v1.11.0
go install github.com/air-verse/air@v1.61.7

# ============================================
# Webapp dependencies
# npm install triggers postinstall which builds
# platform/types, platform/client, platform/components.
# ============================================
echo ">>> Installing webapp dependencies..."
cd "${WORKSPACE_ROOT}/webapp"
npm install

# ============================================
# Prepackaged binaries (mmctl)
# Builds bin/mmctl which is needed for local
# mode admin user creation and management.
# ============================================
echo ">>> Building prepackaged binaries (mmctl)..."
cd "${WORKSPACE_ROOT}/server"
make prepackaged-binaries

# ============================================
# Cloud Agent config
# Copy the pre-built config from .cursor/ into
# server/config/. No jq transformation needed —
# the config is committed as a static file.
# ============================================
echo ">>> Setting up Cloud Agent config..."
cd "${WORKSPACE_ROOT}/server"
make cursor-cloud-setup-config

# ============================================
# agent-browser skill files
# Installs SKILL.md files into .cursor/skills/
# so the Cursor agent knows how to use the
# browser automation CLI.
# -a cursor: target Cursor only
# -y: skip prompts (non-interactive)
# --all: install all skills from the repo
# ============================================
echo ">>> Installing agent-browser skills..."
cd "${WORKSPACE_ROOT}"
npx -y skills add vercel-labs/agent-browser -a cursor -y --all

# ============================================
# Playwright browsers for agent-browser
# agent-browser uses Playwright under the hood.
# Pre-install Chromium so `agent-browser open`
# works without needing `agent-browser install
# --with-deps` first.
# ============================================
echo ">>> Installing Playwright browsers (Chromium)..."
cd "${WORKSPACE_ROOT}"
npx -y playwright install chromium

# ============================================
# AWS CLI
# Needed for uploading screenshots to S3 so
# agents can include before/after images in
# Pull Request descriptions. Authenticated via
# AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
# env vars injected by Cursor Cloud Agent.
# ============================================
if ! command -v aws &>/dev/null; then
    echo ">>> Installing AWS CLI..."
    cd /tmp
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
    unzip -qo awscliv2.zip
    sudo ./aws/install --update
    rm -rf awscliv2.zip aws/
    echo ">>> AWS CLI installed: $(aws --version)"
else
    echo ">>> AWS CLI already installed: $(aws --version)"
fi

echo ""
echo ">>> Install complete!"
echo ">>> Go modules cached, webapp built, mmctl compiled."
echo ">>> Playwright Chromium installed for agent-browser."
echo ">>> AWS CLI installed for S3 screenshot uploads."
echo ">>> Config generated at server/config/config-cursor-cloud.json"
