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
# Enterprise repo (COMMENTED OUT)
#
# Uncomment this block when the Cloud Agent's
# GitHub credentials have access to the private
# mattermost/enterprise repo.
#
# The enterprise repo must be cloned as a SIBLING
# of the repo root — i.e., at ../enterprise relative
# to WORKSPACE_ROOT — so that server/Makefile's
# BUILD_ENTERPRISE_DIR (../../enterprise from server/)
# resolves correctly.
#
# Once cloned, `make setup-go-work` (below) will
# automatically detect the directory and add it to
# go.work. No manual go.work editing is needed.
#
# To enable: uncomment the block below and choose
# ONE of the two auth methods (SSH or HTTPS token).
# ============================================
# ENTERPRISE_DIR="${WORKSPACE_ROOT}/../enterprise"
# if [ ! -d "${ENTERPRISE_DIR}" ]; then
#     echo ">>> Cloning mattermost/enterprise..."
#
#     # Option A: SSH auth (default — works if SSH key is configured)
#     git clone git@github.com:mattermost/enterprise.git "${ENTERPRISE_DIR}"
#
#     # Option B: HTTPS with token (use if SSH is unavailable)
#     # Requires GITHUB_TOKEN env var with repo access.
#     # git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/mattermost/enterprise.git" "${ENTERPRISE_DIR}"
#
#     echo ">>> Enterprise repo cloned to ${ENTERPRISE_DIR}"
# else
#     echo ">>> Enterprise repo already exists at ${ENTERPRISE_DIR}, pulling latest..."
#     cd "${ENTERPRISE_DIR}" && git pull
# fi

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
go install github.com/air-verse/air@latest

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

echo ""
echo ">>> Install complete!"
echo ">>> Go modules cached, webapp built, mmctl compiled."
echo ">>> Config generated at server/config/config-cursor-cloud.json"
