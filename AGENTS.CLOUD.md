# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a **dual-repo capable** Mattermost development environment:

| Repository | Location | Purpose |
|------------|----------|---------|
| `mattermost/mattermost` | `/workspace` | Primary monorepo (Go server + React webapp) |
| `mattermost/enterprise` (optional) | `$HOME/enterprise` | Private enterprise code (Go, linked via `go.work`) |
| `mattermost/mattermost-plugin-agents` (optional) | `$HOME/mattermost-plugin-agents` | AI plugin for validation/testing |

PostgreSQL 14 is the only required external dependency, run via Docker Compose.

The startup update script should be treated as best-effort dependency refresh only. Do not assume it already ran or succeeded; agents should still verify local prerequisites before running services.

### Bootstrap checklist (run this first in every fresh cloud session)

```bash
source "$HOME/.nvm/nvm.sh"
nvm use 24.11
cd /workspace/webapp && npm install
```

Why: snapshots may not always include a valid `webapp/node_modules` state, and the webapp watcher often fails or hangs if dependencies are stale.

### Localization/i18n

When editing translation strings, changes must ONLY be made to the relevant en.json. You MUST NOT change any other localization files.

### Starting services

1. **Ensure Docker daemon is reachable as current user.**

   First check:
   ```bash
   docker ps
   ```
   If this fails with `Cannot connect to the Docker daemon`:
   ```bash
   sudo service docker start
   ```
   If this fails with `permission denied while trying to connect to the Docker daemon socket`:
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```
   (Cloud VMs can restart Docker with socket permissions reset; this is a pragmatic workaround for ephemeral agents.)

2. **Start Team Edition server + webapp (default path):**
   ```bash
   cd /workspace/server && make run
   ```
   This starts dependency containers, runs the server on `:8065`, and starts webpack.

3. **Start Enterprise server + webapp (only when a compatible private enterprise checkout exists):**
   ```bash
   cd /workspace/server && \
     MM_LICENSE="$TEST_LICENSE" \
     MM_PLUGINSETTINGS_ENABLEUPLOADS=true \
     MM_PLUGINSETTINGS_ENABLE=true \
     MM_SERVICESETTINGS_SITEURL=http://localhost:8065 \
     make BUILD_ENTERPRISE_DIR="$HOME/enterprise" run
   ```
   Use this path only if `$HOME/enterprise` is the correct private repo/branch for this server revision.

4. **Optional split-mode startup (recommended when `make run` web watcher appears stuck):**
   - In one terminal:
     ```bash
     cd /workspace/server && make run-server
     ```
   - In a second terminal:
     ```bash
     source "$HOME/.nvm/nvm.sh" && nvm use 24.11
     cd /workspace/webapp/channels && npm run dev-server
     ```

5. **Restart server after code changes (team):**
   ```bash
   cd /workspace/server && make restart-server
   ```

6. **Restart server after code changes (enterprise):**
   ```bash
   cd /workspace/server && \
     MM_LICENSE="$TEST_LICENSE" \
     make BUILD_ENTERPRISE_DIR="$HOME/enterprise" restart-server
   ```
   Webapp changes are picked up by webpack automatically (browser refresh needed).

### Environment verification checklist

After startup, verify all three checks:

```bash
curl -sS http://localhost:8065/api/v4/system/ping
curl -sSI http://localhost:9005
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

Expected:
- ping returns JSON containing `"status":"OK"`;
- port `9005` returns `HTTP/1.1 200 OK`;
- dependency containers (postgres/redis/minio/etc.) are running.

The `TEST_LICENSE` secret provides a Mattermost Enterprise Advanced license. When set via `MM_LICENSE`, the server logs `"License key from ENV is valid, unlocking enterprise features."` and the "TEAM EDITION" badge disappears from the UI.

**You MUST pass `BUILD_ENTERPRISE_DIR="$HOME/enterprise"` to every `make` command** — `run`, `restart-server`, `run-server`, `test-server`, `check-style`, etc. Without it, the Makefile defaults to `../../enterprise` (which doesn't exist), and the build silently falls back to team edition.

### Agents plugin configuration

The plugin is deployed from `$HOME/mattermost-plugin-agents` using:
```bash
cd $HOME/mattermost-plugin-agents && MM_SERVICESETTINGS_SITEURL=http://localhost:8065 make deploy
```

To configure a service and agent, patch the Mattermost config API. The `ANTHROPIC_API_KEY` environment variable must be set.

**Critical gotcha:** The `config` field under `mattermost-ai` must be a JSON **object**, not a JSON string. If stored as a string, the plugin logs `LoadPluginConfiguration API failed to unmarshal`.

Example config patch (use python to safely inject the API key from env):
```python
import json, os
config = {
    "PluginSettings": {
        "Plugins": {
            "mattermost-ai": {
                "config": {  # MUST be an object, NOT json.dumps(...)
                    "services": [{
                        "id": "anthropic-svc-001",
                        "name": "Anthropic Claude",
                        "type": "anthropic",
                        "apiKey": os.environ["ANTHROPIC_API_KEY"],
                        "defaultModel": "claude-sonnet-4-6",
                        "tokenLimit": 200000,
                        "outputTokenLimit": 16000,
                        "streamingTimeoutSeconds": 300
                    }],
                    "bots": [{
                        "id": "claude-bot-001",
                        "name": "claude",
                        "displayName": "Claude Assistant",
                        "serviceID": "anthropic-svc-001",
                        "customInstructions": "You are a helpful AI assistant.",
                        "enableVision": True,
                        "disableTools": False,
                        "channelAccessLevel": 0,
                        "userAccessLevel": 0,
                        "reasoningEnabled": True,
                        "thinkingBudget": 1024
                    }],
                    "defaultBotName": "claude"
                }
            }
        }
    }
}
# Write to temp file, then: curl -X PUT http://localhost:8065/api/v4/config/patch -H "Authorization: Bearer $TOKEN" -d @file.json
```

Supported service types: `openai`, `openaicompatible`, `azure`, `anthropic`, `asage`, `cohere`, `bedrock`, `mistral`. The API key goes in `services[].apiKey`. Never log or print it.

### Key gotchas

- **"TEAM EDITION" means no license, not necessarily no enterprise code.** The webapp shows "TEAM EDITION" when `license.IsLicensed === 'false'`, regardless of `BuildEnterpriseReady`. Fix: pass `MM_LICENSE="$TEST_LICENSE"` when starting the server. To verify enterprise code is loaded independently: check server logs for `"Enterprise Build", enterprise_build: true` or the API at `/api/v4/config/client?format=old` for `BuildEnterpriseReady: true`.
- The server auto-generates `server/config/config.json` on first run; default SQL points to `postgres://mmuser:mostest@localhost/mattermost_test` matching Docker Compose.
- The first user created via `/api/v4/users` gets `system_admin` role automatically.
- SMTP errors and plugin directory warnings on startup are expected in dev — non-blocking.
- License errors in logs ("Failed to read license set in environment") are normal — enterprise features requiring a license won't be available but the server runs fine.
- The enterprise repo must be on a compatible branch with the main repo, and must contain the expected module metadata for `go.work` linkage.
- The VM's global gitconfig may have `url.*.insteadOf` rules embedding the default Cursor agent token, which only has access to `mattermost/mattermost`. The update script cleans these and sets up `gh auth` with `CURSOR_GH_TOKEN` instead.

### Lint, test, and build

**Server (with enterprise):** all commands from `/workspace/server/`, always include `BUILD_ENTERPRISE_DIR="$HOME/enterprise"`:
- **Run:** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" run`
- **Restart:** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" restart-server`
- **Lint:** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" check-style`
- **Tests:** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" test-server` (needs Docker). Quick: `go test ./public/model/...`
- **Standalone build:** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" build-linux` (or use `go build -tags 'enterprise sourceavailable' ...` directly)

**Webapp:** run from `/workspace/webapp/`
- **Lint:** `npm run check`
- **Tests:** `npm run test` (Jest 30)
- **Type check:** `npm run check-types`
- **Build:** `npm run build`

### Browser automation

**agent-browser** (Vercel) is installed globally. It provides a higher-level CLI for browser automation — navigation, clicking, typing, screenshots, accessibility snapshots, and visual diffs. Usage: `agent-browser <command>`. See the agent-browser skill for more information.

### Versions

- Node.js: see `.nvmrc`; `nvm use` from workspace root.
- Go: see `server/go.mod`.
