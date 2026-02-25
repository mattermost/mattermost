# Mattermost Development

Mattermost is an open-source collaboration/messaging platform with a Go backend (`server/`) and React/TypeScript frontend (`webapp/`).

## Cursor Cloud specific instructions

### Services overview

| Service | Description | Port |
|---------|-------------|------|
| Mattermost Server (Go) | Backend API + serves webapp | 8065 |
| PostgreSQL | Primary database | 5432 |
| Inbucket | Fake email server for testing | 9001 (web), 10025 (SMTP) |
| Redis | Cache/session store | 6379 |

### Starting Docker services

Docker must be started manually in Cloud Agent VMs since `systemd` is not running:

```bash
sudo dockerd &>/tmp/dockerd.log &
sleep 3
sudo chmod 666 /var/run/docker.sock
```

Then start the required services:

```bash
cd server && ENABLED_DOCKER_SERVICES="postgres inbucket redis" make start-docker
```

### Running the server

```bash
cd server && make run-server
```

The server runs on port 8065. To verify: `curl -s http://localhost:8065/api/v4/system/ping`

The server's `run-server` target handles `setup-go-work`, `start-docker`, and building the client symlink automatically. If you need to start things separately, ensure `go.work` is set up (`make setup-go-work`) and the `client` symlink exists (`ln -nfs ../webapp/channels/dist client`).

### Building the webapp

```bash
cd webapp && npm install && make dist
```

For development with hot-reloading: `cd webapp && make run` (or `make dev` for webpack-dev-server).

### Lint / Style checks

- **Webapp**: `cd webapp && npm run check` (runs ESLint + Stylelint across all workspaces)
- **Server**: `cd server && go vet ./...`

### Running tests

- **Webapp unit tests**: `cd webapp && npm run test --workspace platform/client` (or any specific workspace)
- **Server unit tests**: `cd server && go test ./public/model/... -count=1 -short -timeout 120s`
- Full server tests need database and are slow: `cd server && make test-server`

### Gotchas

- The Go version must match `server/.go-version` (currently 1.24.13). The system Go at `/usr/bin/go` may be outdated; use `/usr/local/go/bin/go`.
- Node.js must match `.nvmrc` (currently 24.11). Use nvm: `nvm use` from the repo root.
- The webapp uses npm workspaces (not pnpm/yarn). Always use `npm install` from `webapp/`.
- `make run` in `server/` starts both server and webapp in development mode. The server runs in the background by default (`RUN_SERVER_IN_BACKGROUND=true` in `config.mk`).
- When running Jest tests, use `npm run test --workspace <name>` rather than calling `npx jest` directly, because the root-level Jest config differs from workspace-level configs (Jest 30 renamed `--testPathPattern` to `--testPathPatterns`).
- First-time `go run` or `go test` in the server will download many dependencies and can take 60+ seconds.
