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

- `cloud-agent-install.sh` runs after Cursor checks out the repo. It refreshes nvm, installs agent-browser browsers, verifies Cursor's multi-repo `mattermost/enterprise` checkout, runs `server` Go dependency hydration, installs webapp dependencies, and runs Playwright `npm ci`.
- `cloud-agent-start.sh` materializes `.cursor/cursor.md` as `.cursor/AGENTS.md`, fixes current-session Docker socket access, then starts Docker and waits until `docker info` and `docker compose version` succeed.

The environment declares `github.com/mattermost/enterprise` in `repositoryDependencies` so Cursor can provide it as part of the multi-repo workspace. Cursor currently clones the repositories as siblings, such as `/agent/repos/mattermost` and `/agent/repos/enterprise`, which matches `server/Makefile`'s default `../../enterprise` path. The install hook does not clone, pull, or symlink enterprise.

## Useful Skips

Set these environment variables to `true` to shorten startup for narrow tasks:

- `CLOUD_AGENT_SKIP_ENTERPRISE`
- `CLOUD_AGENT_SKIP_GO_DEPS`
- `CLOUD_AGENT_SKIP_WEBAPP_DEPS`
- `CLOUD_AGENT_SKIP_PLAYWRIGHT_DEPS`
- `CLOUD_AGENT_SKIP_AGENT_BROWSER_INSTALL`

## Expected Secrets

- AWS uploads use the standard AWS CLI environment variables provided to the Cloud Agent: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET_NAME`. The image only supplies the `aws` binary.
