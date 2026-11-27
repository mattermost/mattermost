# Cursor Cloud Agent Environment

This directory defines the checked-in Cloud Agent environment for this repository. It serves two setups from one image and one set of hooks:

- **Standard**: `mattermost` plus `mattermost/enterprise`. This is the default and behaves the same whether or not plugins are configured.
- **Super environment**: the standard setup plus the core `mattermost-plugin-*` repos, so one agent can change the server, webapp, Enterprise, and plugins together. `mattermost` is the base repo; plugins are siblings.

The Docker build context is `.cursor/` (the default when `build.context` is omitted; `.`, `./`, and `..` now mean the repository root). The Dockerfile intentionally does not copy the repository; Cursor checks out the requested commit at runtime.

## What Is Baked Into The Image

- Ubuntu 24.04.
- Docker CE 28.5.2 with `fuse-overlayfs` and `iptables-legacy`, matching Cursor's Docker-in-Cloud guidance for complex compose setups.
- Go from `server/.go-version`. The install hook installs that version if the image is stale or the agent did not boot from this Dockerfile.
- Node from `.nvmrc` via nvm. The install hook installs that version if the image is stale or the agent did not boot from this Dockerfile. Plugin Node versions are not baked in; the install hook adds each plugin's `.nvmrc` version through nvm, and the Build snapshot keeps them.
- Browser runtime libraries for the Playwright e2e suite.
- AWS CLI v2 for S3 uploads.
- Common Mattermost build/test tools: `make`, `jq`, `xmlsec1`, `pgloader`, Git LFS, GitHub CLI, Python 3, and build essentials.

## Runtime Hooks

- `cloud-agent-install.sh` runs while Cursor creates a Build (and can be rerun by agents). It repairs Go/Node drift, locates or clones `mattermost/enterprise`, runs `server` Go dependency hydration, installs webapp dependencies, runs Playwright `npm ci`, then handles plugins (see below). It must stay idempotent.
- `cloud-agent-start.sh` runs when an agent boots. It materializes `.cursor/cursor.md` as `.cursor/AGENTS.md`, fixes current-session Docker socket access, starts Docker (clearing a stale `docker.pid` from the snapshot), waits until `docker info` and `docker compose version` succeed, then logs in to Docker Hub when credentials are configured.
- `cloud-agent-lib.sh` holds helpers shared by the hooks and `super-env.sh`: sibling discovery, shallow cloning with like-named branch matching, and per-plugin Node resolution.
- `super-env.sh` is the agent-facing CLI for the super environment: `list`, `exec`, `deploy`, `link`/`unlink` (out-of-tree `go.work` against the local `server/public`), and `sync`. See `.cursor/cursor.md`.

### Enterprise

`repositoryDependencies` only adds repos to the agent's git credentials; it never clones them. Cursor checks out sibling repos only when they are part of a multi-repo environment, such as `/agent/repos/mattermost` and `/agent/repos/enterprise`, which matches `server/Makefile`'s default `../../enterprise` path.

When no usable Enterprise checkout is present (single-repo runs and git-triggered automations), the install hook clones `https://github.com/mattermost/enterprise.git` into `../enterprise`. It uses `ENTERPRISE_BRANCH` when set, otherwise preferring an exact branch matching the Mattermost checkout and falling back to Enterprise's default branch. If the sibling path is not writable or is not a usable work tree (for example a bare repo), the hook clones into `$HOME/enterprise` and writes `BUILD_ENTERPRISE_DIR` to `server/config.override.mk`. `server/Makefile` includes that file before Enterprise detection so `make run-server` honors the fallback path.

### Plugins

The core plugin list is the set of `github.com/mattermost/mattermost-plugin-*` entries in `repositoryDependencies`: mostly the plugins `server/Makefile` prepackages, with Boards v2 in place of Boards, plus Weave and the Google Calendar, Drive, and Meet plugins. `mattermost-plugin-dataminr` is left out because the Cloud Agent token cannot read it. Listing them there grants the git token access, and the install hook reads the same list, so there is a single place to add or remove a plugin.

The install hook:

1. Clones missing core plugins when `CLOUD_AGENT_SUPER_ENV=true`, or the plugins named in `CLOUD_AGENT_PLUGINS`. Clones are shallow, go to `../mattermost-plugin-<name>` (or `$HOME/...`), prefer a branch named like the Mattermost checkout's branch (or `CLOUD_AGENT_PLUGIN_BRANCH`), and fall back to the default branch. Later Builds fast-forward these clones when they are clean.
2. Hydrates every `mattermost-plugin-*` checkout it finds next to `mattermost` or in `$HOME`, including repos Cursor cloned for a multi-repo environment: `go mod download` and `make webapp/node_modules` (or `npm ci --prefix webapp`) with the plugin's `.nvmrc` Node on `PATH`. The default Node and `/usr/local/bin` symlinks stay on this repo's `.nvmrc`.
3. Logs a warning and continues when one plugin fails, so a single broken plugin does not fail the Build.

The plugins' own `.cursor/` setups are not run. They target a standalone prebuilt Mattermost image and repoint the global Node at the plugin's version.

## Setting Up The Super Environment

Cursor resolves the environment in this order: a personal saved environment, a team saved environment, then `.cursor/environment.json` (single-repo runs only). A saved environment reads this file only when its environment.json location points at it. Either setup below works:

- **Multi-repo saved environment (recommended)**: in the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents), create an environment with `mattermost/mattermost`, `mattermost/enterprise`, and the plugin repos you want. Set its environment.json location to `mattermost/mattermost`'s `.cursor/environment.json`. Cursor clones every repo as a sibling and the install hook hydrates the plugins it finds. Optionally add `CLOUD_AGENT_SUPER_ENV=true` as an environment-scoped secret so any core plugin you did not select is cloned too.
- **Single repo plus flag**: use an environment that points at this file and add `CLOUD_AGENT_SUPER_ENV=true` (or `CLOUD_AGENT_PLUGINS=playbooks,agents,...`) as an environment-scoped secret. The install hook clones the plugins using the token scope from `repositoryDependencies`.

Keep the standard environment free of those variables. Without them, the install hook does not clone plugins, though it still hydrates any `mattermost-plugin-*` checkout already present.

Expect the first super-environment Build to take noticeably longer than a standard one: each plugin installs its own `node_modules` (roughly 0.25–1 GB each). Later Builds reuse that state.

## Useful Skips And Options

Set these environment variables to `true` to shorten startup for narrow tasks:

- `CLOUD_AGENT_SKIP_ENTERPRISE`
- `CLOUD_AGENT_SKIP_GO_DEPS`
- `CLOUD_AGENT_SKIP_WEBAPP_DEPS`
- `CLOUD_AGENT_SKIP_PLAYWRIGHT_DEPS`
- `CLOUD_AGENT_SKIP_PLUGINS`: no plugin cloning or hydration.
- `CLOUD_AGENT_SKIP_PLUGIN_DEPS`: clone plugins but skip their `go mod download` and `node_modules`.

Super environment options:

- `CLOUD_AGENT_SUPER_ENV=true`: clone every core plugin.
- `CLOUD_AGENT_PLUGINS`: comma- or space-separated plugin names (`playbooks`, `boards-v2`, `mattermost-plugin-agents`), `all`, or `none`. Overrides `CLOUD_AGENT_SUPER_ENV`.
- `CLOUD_AGENT_PLUGIN_BRANCH`: branch to try first for every plugin clone.

## Expected Secrets

Configure these in the [Cursor Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents) as environment-scoped secrets for the Mattermost Cloud Agent environment.

- AWS uploads use the standard AWS CLI environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET_NAME`. The image only supplies the `aws` binary.
- Docker Hub pulls use the same variable names as CI: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. The start hook runs `docker login` after `dockerd` is ready. Mark `DOCKERHUB_TOKEN` as **redacted** in the dashboard. When both are set, agents can pull the full default `make start-docker` image set without hitting anonymous rate limits.
- `MM_LICENSE` (redacted, optional): applied when the server starts. Without it the server applies an Entry license.

## Validating Changes

```bash
python3 -m json.tool .cursor/environment.json >/dev/null
for f in .cursor/scripts/*.sh; do bash -n "$f"; done
(cd .cursor/scripts && shellcheck -x ./*.sh)
docker build --check -f .cursor/Dockerfile .cursor
docker build -f .cursor/Dockerfile .cursor
CLOUD_AGENT_PLUGINS=github bash .cursor/scripts/cloud-agent-install.sh
.cursor/scripts/super-env.sh list
```
