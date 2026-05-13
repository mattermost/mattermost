# Cursor Cloud Agent Instructions

These instructions apply to Cursor Cloud Agents after `.cursor/scripts/cloud-agent-start.sh` materializes this file as `.cursor/AGENTS.md`.

## Environment

- Docker must be available. If `docker info` fails, inspect `/tmp/docker-service-start.log` and `/tmp/dockerd.log`; do not assume a snapshot will provide Docker.
- The image includes Go, Node/npm, Docker Compose, AWS CLI v2, and `agent-browser`.
- The install hook attempts to clone `mattermost/enterprise` as a sibling checkout. Use `ENTERPRISE_DIR`, `BUILD_ENTERPRISE_DIR`, or `ENTERPRISE_BRANCH` only when the default branch/path is wrong for the task.

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

## Tests And Setup

- Backend workspace setup is handled by `cd server && make setup-go-work`; never run `go mod tidy` directly.
- Webapp dependencies are installed with `cd webapp && make node_modules`.
- Playwright dependencies are installed with `cd e2e-tests/playwright && npm ci`.
- For full Playwright compose flows, use the existing `e2e-tests` Makefile and scripts. Docker Compose is available in the Cloud Agent image.

## Browser Screenshots

Use `agent-browser` for browser automation and screenshots. If the CLI is missing or browsers are unavailable, run:

```bash
npm install -g agent-browser@0.27.0
agent-browser install
```

Prefer verifying UI changes against the running local Mattermost instance before opening or updating a PR.

## AWS And PR Artifacts

AWS CLI v2 is installed for uploading screenshots or reports. Prefer Cursor's IAM role integration; when configured, the environment provides `AWS_CONFIG_FILE`, `AWS_PROFILE=cursor-cloud-agent`, and `AWS_SDK_LOAD_CONFIG=1`.

Before uploading, verify credentials with:

```bash
aws sts get-caller-identity
```

Do not hardcode AWS credentials or bucket secrets in the repository.
