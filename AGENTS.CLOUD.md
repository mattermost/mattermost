# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a **dual-repo** Mattermost enterprise development environment:

| Repository | Location | Purpose |
|------------|----------|---------|
| `mattermost/mattermost` | `/workspace` | Primary monorepo (Go server + React webapp) |
| `mattermost/enterprise` | `$HOME/enterprise` | Private enterprise code (Go, linked via `go.work`) |
| `mattermost/mattermost-plugin-agents` | `$HOME/mattermost-plugin-agents` | AI plugin for validation/testing |

PostgreSQL 14 is the only required external dependency, run via Docker Compose.

The update script handles: git auth, repo cloning, npm install, Go workspace setup, config.override.mk, and the client symlink. See below for what remains manual.

### Localization/i18n

When editing translation strings, changes must ONLY be made to the relevant en.json. You MUST NOT change any other localization files.

### Starting services

After the update script has run:

1. **Start Docker daemon** (if not already running): `sudo dockerd &>/tmp/dockerd.log &` — wait a few seconds, verify with `docker info`.
2. **Start server + webapp together:**
   ```bash
   cd /workspace/server && \
     MM_LICENSE="$TEST_LICENSE" \
     MM_PLUGINSETTINGS_ENABLEUPLOADS=true \
     MM_PLUGINSETTINGS_ENABLE=true \
     MM_SERVICESETTINGS_SITEURL=http://localhost:8065 \
     make BUILD_ENTERPRISE_DIR="$HOME/enterprise" run
   ```
   This single command starts Docker (postgres), builds mmctl, sets up the `go.work` and client symlink, compiles the Go server with enterprise tags, runs it in the background, then starts the webpack watcher for the webapp. The server listens on `:8065`.
3. **Restart server after code changes:**
   ```bash
   cd /workspace/server && \
     MM_LICENSE="$TEST_LICENSE" \
     make BUILD_ENTERPRISE_DIR="$HOME/enterprise" restart-server
   ```
   This stops the running server and re-runs it with enterprise. Webapp changes are picked up by webpack automatically (browser refresh needed).

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

- **"TEAM EDITION" means no license, not no enterprise code.** The webapp shows "TEAM EDITION" when `license.IsLicensed === 'false'`, regardless of `BuildEnterpriseReady`. Fix: pass `MM_LICENSE="$TEST_LICENSE"` when starting the server. To verify enterprise code is loaded independently: check server logs for `"Enterprise Build", enterprise_build: true` or the API at `/api/v4/config/client?format=old` for `BuildEnterpriseReady: true`.
- The server auto-generates `server/config/config.json` on first run; default SQL points to `postgres://mmuser:mostest@localhost/mattermost_test` matching Docker Compose.
- The first user created via `/api/v4/users` gets `system_admin` role automatically.
- SMTP errors and plugin directory warnings on startup are expected in dev — non-blocking.
- License errors in logs ("Failed to read license set in environment") are normal — enterprise features requiring a license won't be available but the server runs fine.
- The enterprise repo must be on a compatible branch with the main repo.
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
