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
# Temporarily disabled due private-repo auth
# failures in the Cursor install environment.
# ============================================
# MM_CLONE_ENTERPRISE="${MM_CLONE_ENTERPRISE:-false}"
# ENTERPRISE_DIR="${MM_ENTERPRISE_DIR:-${WORKSPACE_ROOT}/../enterprise}"
# if [ -n "${MM_ENTERPRISE_DIR:-}" ]; then
#     export BUILD_ENTERPRISE_DIR="${ENTERPRISE_DIR}"
#     echo ">>> Using custom BUILD_ENTERPRISE_DIR=${BUILD_ENTERPRISE_DIR}"
# fi
# if [ "${MM_CLONE_ENTERPRISE}" = "true" ]; then
#     echo ">>> Cloning mattermost/enterprise..."
#     git clone git@github.com:mattermost/enterprise.git "${ENTERPRISE_DIR}"
# fi
echo ">>> Skipping enterprise clone (temporarily disabled)."

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
