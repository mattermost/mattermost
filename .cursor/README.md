# Cursor Cloud Agent Environment

This directory defines the checked-in Cloud Agent environment for this repository. Cursor resolves `.cursor/environment.json` before personal or team saved environments, so this replaces the snapshot-dependent `/onboard` flow for agents started from this repo.

The Docker build context is `.cursor/` only. The Dockerfile intentionally does not copy the repository; Cursor checks out the requested commit at runtime.

## What Is Baked Into The Image

- Ubuntu 24.04.
- Docker CE 28.5.2 with `fuse-overlayfs` and `iptables-legacy`, matching Cursor's Docker-in-Cloud guidance for complex compose setups.
- Go from `server/.go-version` (currently 1.26.10). The install hook installs that version if the image is stale or the agent did not boot from this Dockerfile.
- Node from `.nvmrc` (currently 24.11, image pin 24.11.1) via nvm. The install hook installs that version if the image is stale or the agent did not boot from this Dockerfile.
- Browser runtime libraries for the Playwright e2e suite.
- AWS CLI v2 for S3 uploads.
- Common Mattermost build/test tools: `make`, `jq`, `xmlsec1`, `pgloader`, Git LFS, GitHub CLI, Python 3, and build essentials.

## Runtime Hooks

- `cloud-agent-install.sh` runs after Cursor checks out the repo. It refreshes nvm, locates or clones `mattermost/enterprise`, runs `server` Go dependency hydration, installs webapp dependencies, and runs Playwright `npm ci`.
- `fetch-fork.sh` is not a boot hook. An agent runs it on demand when the work reaches into one of the Mattermost dependency forks; see "Dependency Forks" below.
- `cloud-agent-start.sh` materializes `.cursor/cursor.md` as `.cursor/AGENTS.md`, fixes current-session Docker socket access, starts Docker, waits until `docker info` and `docker compose version` succeed, then logs in to Docker Hub when credentials are configured.

The environment declares `github.com/mattermost/enterprise` and `github.com/mattermost/pdf` in `repositoryDependencies` so Cursor can provide them as part of the multi-repo workspace and so the Cloud Agent GitHub token can read them, which Enterprise needs because it is private. Cursor currently clones the repositories as siblings when you explicitly select the multi-repo environment, such as `/agent/repos/mattermost` and `/agent/repos/enterprise`, which matches `server/Makefile`'s default `../../enterprise` path.

Git-triggered automations (for example, a PR label) still launch in a single-repo layout. `repositoryDependencies` only adds the declared repositories to the token scope in that mode; it does not check them out. The install hook therefore clones `https://github.com/mattermost/enterprise.git` into `../enterprise` when no usable checkout is present. It uses `ENTERPRISE_BRANCH` when set, otherwise preferring an exact branch matching the Mattermost checkout and falling back to Enterprise's default branch. If the sibling path is not writable or is not a usable work tree (for example a bare repo), the hook clones into `$HOME/enterprise` and writes `BUILD_ENTERPRISE_DIR` to `server/config.override.mk`. `server/Makefile` includes that file before Enterprise detection so `make run-server` honors the fallback path.

## Dependency Forks

Some of what the server runs lives in Mattermost forks of third-party libraries,
pinned by commit in `server/go.mod` — `github.com/mattermost/pdf` is the one
wired up so far. A change to one of those is not reachable from a checkout of
this repository alone, so `.cursor/scripts/fetch-fork.sh` clones the fork as a
sibling and adds it to `server/go.work`:

```bash
.cursor/scripts/fetch-fork.sh pdf
```

With the fork in the workspace, `server` builds and tests against the working
copy at `../pdf` instead of the pinned commit. That is what makes it possible to
write a test in `server` that exercises the fork through the code which actually
consumes it, change the fork, and watch that test go from red to green in one
place — before the fork change is merged and the pin is moved.

The script is deliberately not part of the install hook. Git-triggered agents
launch single-repo, so a fork in `repositoryDependencies` costs nothing at boot;
cloning all of them for every agent would charge every task for something almost
none of them need.

Notes:

- `go.work` is gitignored, so wiring a fork into the workspace cannot leak into
  a commit. A `replace` directive in `server/go.mod` can, which is why this uses
  `go work use` instead.
- `make setup-go-work` rewrites `go.work` from scratch and drops the fork. Any
  `make` target that depends on it does the same. Pass
  `SKIP_SETUP_GO_WORK=true` to those targets while a fork is wired in, or
  re-run the script after they finish.
- The pin in `server/go.mod` is what ships. A change to a fork is only in the
  product once it is merged there and `go.mod` is moved to the new commit, which
  is a separate pull request against this repository.
- Adding a fork needs two edits: a case in `fetch-fork.sh` and an entry in
  `repositoryDependencies`, without which the Cloud Agent token cannot read it.

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
