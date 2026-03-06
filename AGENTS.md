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

### Starting services

After the update script has run:

1. **Start Docker daemon** (if not already running): `sudo dockerd &>/tmp/dockerd.log &` — wait a few seconds, then verify with `docker info`.
2. **Start PostgreSQL:** `cd /workspace/server && make start-docker`
3. **Build enterprise server:** `cd /workspace/server && go build -tags 'enterprise sourceavailable' -ldflags '-X "github.com/mattermost/mattermost/server/public/model.BuildNumber=dev" -X "github.com/mattermost/mattermost/server/public/model.BuildEnterpriseReady=true"' -o ./bin/mattermost ./cmd/mattermost`
4. **Run enterprise server:** `cd /workspace/server && MM_PLUGINSETTINGS_ENABLEUPLOADS=true MM_PLUGINSETTINGS_ENABLE=true MM_SERVICESETTINGS_SITEURL=http://localhost:8065 ./bin/mattermost` — add `&` to background. Listens on `:8065`.
5. **Webapp:** `cd /workspace/webapp && make run` (webpack build+watch) or `make dev` (HMR dev server).

### Agents plugin configuration

The plugin is deployed from `$HOME/mattermost-plugin-agents` using:
```
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

- The server auto-generates `server/config/config.json` on first run; default SQL points to `postgres://mmuser:mostest@localhost/mattermost_test` matching Docker Compose.
- The first user created via `/api/v4/users` gets `system_admin` role automatically.
- SMTP errors and plugin directory warnings on startup are expected in dev — non-blocking.
- When running `make` commands that involve enterprise, always pass `BUILD_ENTERPRISE_DIR="$HOME/enterprise"`.
- License errors in logs ("Failed to read license set in environment") are normal — enterprise features requiring a license won't be available but the server runs fine.
- The enterprise repo must be on a compatible branch with the main repo.
- The VM's global gitconfig may have `url.*.insteadOf` rules embedding the default Cursor agent token, which only has access to `mattermost/mattermost`. The update script cleans these and sets up `gh auth` with `CURSOR_GH_TOKEN` instead.

### Lint, test, and build

**Server (with enterprise):** run from `/workspace/server/`
- **Build:** `go build -tags 'enterprise sourceavailable' -o ./bin/mattermost ./cmd/mattermost/`
- **Vet:** `go vet -tags 'enterprise sourceavailable' ./cmd/mattermost/...`
- **Lint:** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" check-style`
- **Tests:** `make BUILD_ENTERPRISE_DIR="$HOME/enterprise" test-server` (needs Docker). Quick: `go test ./public/model/...`

**Webapp:** run from `/workspace/webapp/`
- **Lint:** `npm run check`
- **Tests:** `npm run test` (Jest 30)
- **Type check:** `npm run check-types`
- **Build:** `npm run build`

### Cross-repo PR workflow

When changes span both repos, create branches and PRs independently. Use `gh pr create --repo mattermost/mattermost ...` and `gh pr create --repo mattermost/enterprise ...`. Link companion PRs in the body and state merge order.

### Versions

- Node.js: see `.nvmrc` (currently `24.11`); `nvm use` from workspace root.
- Go: see `server/go.mod` (currently `1.24.13`).
