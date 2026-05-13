# Cursor Cloud Agent Environment

This directory defines the checked-in Cloud Agent environment for this repository. Cursor resolves `.cursor/environment.json` before personal or team saved environments, so this replaces the snapshot-dependent `/onboard` flow for agents started from this repo.

The Docker build context is `.cursor/` only. The Dockerfile intentionally does not copy the repository; Cursor checks out the requested commit at runtime.

## What Is Baked Into The Image

- Ubuntu 24.04.
- Docker CE 28.5.2 with `fuse-overlayfs` and `iptables-legacy`, matching Cursor's Docker-in-Cloud guidance for complex compose setups.
- Go 1.25.9 from `server/.go-version`.
- Node 24.11.1/npm 11 via nvm, matching `.nvmrc` and `webapp/package.json`.
- `agent-browser@0.27.0` and browser dependencies for screenshot workflows.
- AWS CLI v2 for S3 uploads.
- Common Mattermost build/test tools: `make`, `jq`, `xmlsec1`, `pgloader`, Git LFS, GitHub CLI, Python 3, and build essentials.

## Runtime Hooks

- `cloud-agent-install.sh` runs after Cursor checks out the repo. It refreshes nvm, installs agent-browser browsers, clones or updates `mattermost/enterprise` with `CURSOR_GH_TOKEN`, runs `server` Go dependency hydration, installs webapp dependencies, and runs Playwright `npm ci`.
- `cloud-agent-start.sh` materializes `.cursor/cursor.md` as `.cursor/AGENTS.md`, fixes current-session Docker socket access, then starts Docker and waits until `docker info` and `docker compose version` succeed.

The enterprise checkout defaults to `$HOME/enterprise` and is symlinked to `/enterprise` after cloning. This keeps the private enterprise repository outside the checked-out Mattermost workspace while still giving `server/Makefile` a stable build path. Override the checkout path with `ENTERPRISE_CHECKOUT_DIR` only when needed. The script checks out the current server branch in enterprise when that branch exists, falls back to `master`, and can be forced with `ENTERPRISE_BRANCH`.

## Useful Skips

Set these environment variables to `true` to shorten startup for narrow tasks:

- `CLOUD_AGENT_SKIP_ENTERPRISE`
- `CLOUD_AGENT_SKIP_GO_DEPS`
- `CLOUD_AGENT_SKIP_WEBAPP_DEPS`
- `CLOUD_AGENT_SKIP_PLAYWRIGHT_DEPS`
- `CLOUD_AGENT_SKIP_AGENT_BROWSER_INSTALL`

## Expected Secrets

- `CURSOR_GH_TOKEN` is needed for the private `mattermost/enterprise` clone until Cursor multi-repo environments are enabled for this repo group.
- AWS uploads use the standard AWS CLI environment variables provided to the Cloud Agent: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET_NAME`. The image only supplies the `aws` binary.
