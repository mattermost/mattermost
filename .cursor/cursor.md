# Cursor Cloud Agent Instructions

These instructions apply to Cursor Cloud Agents after `.cursor/scripts/cloud-agent-start.sh` materializes this file as `.cursor/AGENTS.md`.

## Environment

- Docker must be available. If `docker info` fails, inspect `/tmp/docker-service-start.log` and `/tmp/dockerd.log`; do not assume a snapshot will provide Docker.
- The image includes Go, Node/npm, Docker Compose, and AWS CLI v2.
- Cursor should provide `mattermost/enterprise` through the multi-repo environment. The expected layout is sibling repositories, such as `/agent/repos/mattermost` and `/agent/repos/enterprise`; this matches `server/Makefile`'s default `../../enterprise` path.

## Running Mattermost

1. Start dependencies:

   ```bash
   cd server
   make start-docker
   ```

2. Start the server:

   ```bash
   cd server
   make run-server
   ```

3. Start the web app in another terminal when UI work needs live verification:

   ```bash
   cd webapp
   make run
   ```

The Mattermost server is expected at `http://localhost:8065`. The webapp dev server commonly uses `http://localhost:9005`.

### Known-good Cloud flow

- In this multi-repo Cloud environment, `mattermost` and `enterprise` are expected to start from `master`, so sibling checkout skew should not need extra handling.
- `server/Makefile`'s `run` target only reaches `run-client` if the server is backgrounded. In Cloud, the reliable combined startup is:

  ```bash
  cd server
  ENABLED_DOCKER_SERVICES='postgres redis' RUN_SERVER_IN_BACKGROUND=true make run
  ```

- If you want split terminals instead, use:

  ```bash
  cd server
  ENABLED_DOCKER_SERVICES='postgres redis' make run-server
  ```

  and then:

  ```bash
  cd webapp
  make run
  ```

- When the server starts and `MM_LICENSE` is present in the environment, the server applies that license automatically. If `MM_LICENSE` is not set, starting the server automatically applies an Entry license, which provides nearly all functionality needed for development.
- When `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are configured as Cloud Agent secrets, `cloud-agent-start.sh` logs in to Docker Hub and the full default `make start-docker` dependency set can be used without trimming services.
- `ENABLED_DOCKER_SERVICES='postgres redis'` avoids optional local-dev services such as Prometheus, Grafana, Loki, Minio, Azurite, and OpenLDAP. Use this fallback when Docker Hub credentials are unavailable and anonymous pulls hit rate limits.
- If the first-user signup UI is flaky but the server is already healthy, seed local state with `mmctl` and then log in through the browser:

  ```bash
  cd server
  ./bin/mmctl --local user create --email cursor@example.com --username cursoradmin --password Password123! --system-admin --email-verified --disable-welcome-email
  ./bin/mmctl --local team create --name cursorteam --display-name "Cursor Team" --email cursor@example.com
  ```

- A healthy server responds at:

  ```bash
  curl http://127.0.0.1:8065/api/v4/system/ping
  ```

## Tests And Setup

- Backend workspace setup is handled by `cd server && make setup-go-work`; never run `go mod tidy` directly.
- Webapp dependencies are installed with `cd webapp && make node_modules`.
- Playwright dependencies are installed with `cd e2e-tests/playwright && npm ci`.
- For full Playwright compose flows, use the existing `e2e-tests` Makefile and scripts. Docker Compose is available in the Cloud Agent image.

### Playwright upgrade-path tests (branch `e2e/playwright-upgrade-path-tests`)

Rolling-upgrade coverage lives in a **separate CI pipeline** (not inside `e2e-tests-playwright-template.yml`). Locally:

```bash
cd e2e-tests/playwright
npm run testcontainers:down
MM_LICENSE=<key> PW_UPGRADE_FROM_SERVER_IMAGE=mattermostdevelopment/mattermost-enterprise-edition:release-11.9 npm run test:upgrade:from
SERVER_IMAGE=mattermostdevelopment/mattermost-enterprise-edition:master npm run test:upgrade:to
npm run testcontainers:down
```

- `script/resolve_upgrade_matrix.mjs` — outputs JSON with `dockerTag`, `isESR`, `contextLabel`; prints `[]` when no supported from-versions (CI posts `e2e-test/playwright-full/{edition}/upgrade-from-none`).
- CI rolling upgrades run on merge/release automatically; PR runs only when `run_rolling_upgrades` is enabled on manual `e2e-tests-ci.yml` dispatch. `e2e-tests-playwright-rolling-upgrades.yml` also has its own **Run workflow** button for ad-hoc runs without a PR.
- CI shape: the entry workflow resolves the matrix and calls `...-rolling-upgrades-template.yml` once per from-version (from-image + to-image). Each of that version's workers runs the harness then continues straight into the normal full suite (`dispatch-run`, with no re-preparation in between — the upgraded server must be usable as-is), so the suite runs against a server that got to the to-image by upgrading. One commit status per from-version, nothing aggregate. Locally only the harness runs.
- Pulling `release-*` server images requires Docker Hub login (`DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`). Set `MM_LICENSE` for licensed upgrade-from scenarios.
- Before opening/updating the PR: run `npm run check` in `e2e-tests/playwright` and fix any eslint errors; then verify a full `upgrade-from` → `upgrade-to` run is green.

## Browser Verification

Use the `computerUse` subagent's desktop (Chrome is preinstalled) for browser automation and screenshots. Prefer verifying UI changes against the running local Mattermost instance before opening or updating a PR.

## AWS And PR Artifacts

AWS CLI v2 is installed for uploading screenshots or reports. Cloud Agents should receive `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET_NAME` as environment variables.

Before uploading, verify credentials with:

```bash
aws sts get-caller-identity
```

- If the configured S3 bucket is public, upload with `aws s3 cp` and share the plain object URL `https://$AWS_S3_BUCKET_NAME.s3.amazonaws.com/<key>` instead of generating a presigned URL.
Do not hardcode AWS credentials or bucket secrets in the repository.
