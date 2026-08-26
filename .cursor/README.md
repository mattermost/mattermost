# Cursor Cloud Agent Environment

This directory defines the checked-in Cloud Agent environment for this repository. Cursor resolves `.cursor/environment.json` before personal or team saved environments, so this replaces the snapshot-dependent `/onboard` flow for agents started from this repo.

The Docker build context is `.cursor/` only. The Dockerfile intentionally does not copy the repository; Cursor checks out the requested commit at runtime.

## What Is Baked Into The Image

- Ubuntu 24.04.
- Docker CE 28.5.2 with `fuse-overlayfs` and `iptables-legacy`, matching Cursor's Docker-in-Cloud guidance for complex compose setups.
- Go 1.25.9 from `server/.go-version`.
- Node 24.11.1/npm 11 via nvm, matching `.nvmrc` and `webapp/package.json`.
- Browser runtime libraries for the Playwright e2e suite.
- AWS CLI v2 for S3 uploads.
- Common Mattermost build/test tools: `make`, `jq`, `xmlsec1`, `pgloader`, Git LFS, GitHub CLI, Python 3, and build essentials.

## Runtime Hooks

- `cloud-agent-install.sh` runs after Cursor checks out the repo. It refreshes nvm, locates or clones `mattermost/enterprise`, runs `server` Go dependency hydration, installs webapp dependencies, and runs Playwright `npm ci`.
- `cloud-agent-start.sh` materializes `.cursor/cursor.md` as `.cursor/AGENTS.md`, fixes current-session Docker socket access, starts Docker, waits until `docker info` and `docker compose version` succeed, then logs in to Docker Hub when credentials are configured.

The environment declares `github.com/mattermost/enterprise` in `repositoryDependencies` so Cursor can provide it as part of the multi-repo workspace and so the Cloud Agent GitHub token can read that private repo. Cursor currently clones the repositories as siblings when you explicitly select the multi-repo environment, such as `/agent/repos/mattermost` and `/agent/repos/enterprise`, which matches `server/Makefile`'s default `../../enterprise` path.

Git-triggered automations (for example, a PR label) still launch in a single-repo layout. `repositoryDependencies` only adds enterprise to the token scope in that mode; it does not check the repo out. The install hook therefore clones `https://github.com/mattermost/enterprise.git` into `../enterprise` when no usable checkout is present. It uses `ENTERPRISE_BRANCH` when set, otherwise preferring an exact branch matching the Mattermost checkout and falling back to Enterprise's default branch. If the sibling path is not writable or is not a usable work tree (for example a bare repo), the hook clones into `$HOME/enterprise` and writes `BUILD_ENTERPRISE_DIR` to `server/config.override.mk`. `server/Makefile` includes that file before Enterprise detection so `make run-server` honors the fallback path.

## Useful Skips

Set these environment variables to `true` to shorten startup for narrow tasks:

- `CLOUD_AGENT_SKIP_ENTERPRISE`
- `CLOUD_AGENT_SKIP_GO_DEPS`
- `CLOUD_AGENT_SKIP_WEBAPP_DEPS`
- `CLOUD_AGENT_SKIP_PLAYWRIGHT_DEPS`

## Expected Secrets

Configure these in the [Cursor Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents) as environment-scoped secrets for the Mattermost Cloud Agent environment.

- AWS uploads use the standard AWS CLI environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET_NAME`. The image only supplies the `aws` binary.
- Docker Hub pulls use the same variable names as CI: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. The start hook runs `docker login` after `dockerd` is ready. Mark `DOCKERHUB_TOKEN` as **redacted** in the dashboard. When both are set, agents can pull the full default `make start-docker` image set without hitting anonymous rate limits.
