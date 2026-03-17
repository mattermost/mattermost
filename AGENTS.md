# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Overview

Mattermost is an open-source collaboration platform with a Go backend and React/TypeScript frontend. The repository is a monorepo containing:

- **`server/`** - Go backend (v8 module at `github.com/mattermost/mattermost/server/v8`)
- **`webapp/`** - React/TypeScript frontend with npm workspaces
- **`api/`** - OpenAPI v4 specification
- **`e2e-tests/`** - Cypress and Playwright E2E tests
- **`tools/`** - Build utilities including `mmgotool` for i18n

## Build & Development Commands

### Server (Go)
```bash
cd server/
make run                    # Run server + webapp (requires docker)
make run-server             # Run Go server only
make test-server            # Run all Go tests (uses gotestsum)
make test-server-quick      # Run tests with -short flag
make golangci-lint          # Run linter (installs v1.57.1)
make build                  # Build production binary
make start-docker           # Start Docker services (mysql/postgres/minio/inbucket)
```

**Important:** Tests require Docker services running first. Use `ENABLED_DOCKER_SERVICES` env var to control which services start (default: `mysql postgres inbucket`).

### Running a Single Go Test
```bash
# Via gotestsum (recommended)
cd server/
./bin/gotestsum -- -run TestFunctionName ./path/to/package

# Via go test directly
cd server/
go test -run TestFunctionName -v ./channels/app
```

### Webapp (React/TypeScript)
```bash
cd webapp/
npm install                 # Installs workspace dependencies
npm run run                 # Webpack watch mode
npm run dev-server          # Webpack dev server with HMR
npm run test                # Jest tests (TZ=Etc/UTC)
npm run test:watch          # Jest in watch mode
npm run check               # ESLint + stylelint
npm run fix                 # Auto-fix linting issues
npm run check-types         # TypeScript type checking
```

### Running a Single Jest Test
```bash
cd webapp/channels/
npm test -- --testPathPattern="ComponentName"
npm test -- --testNamePattern="test description"
```

## Code Generation Commands

```bash
# Server
cd server/
make new-migration name=<migration_name>    # Creates both MySQL and PostgreSQL migrations
make store-mocks                            # Generate store mocks with mockery
make telemetry-mocks                        # Generate telemetry mocks
make app-layers                             # Generate App interface layers
make i18n-extract                           # Extract i18n strings

# Webapp
cd webapp/channels/
npm run i18n-extract                        # Extract translation strings
npm run make-emojis                         # Generate emoji data
```

## Key Configuration

- **Go version:** 1.21 (specified in `go.mod` and `.nvmrc` for Node version)
- **Node version:** 20.11 (specified in `.nvmrc`)
- **Webapp workspaces:** `channels/`, `platform/client`, `platform/components`, `platform/types`

### Docker Services Configuration

Edit `server/config.mk` or create `server/config.override.mk`:
- `ENABLED_DOCKER_SERVICES` - Space-separated list: `mysql`, `postgres`, `minio`, `inbucket`, `openldap`, `elasticsearch`, `keycloak`
- `MM_NO_DOCKER=true` - Disable Docker entirely

## Code Style Guidelines

### Go
- **Indentation:** Tabs (per `.editorconfig`)
- **Required header:** All files must include the copyright header:
  ```go
  // Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
  // See LICENSE.txt for license information.
  ```
- **Linter:** golangci-lint v1.57.1 (run via `make golangci-lint`)
- **Import organization:** Standard library first, then external, then internal
- **Mock generation:** Use mockery v2.42.2 (installed automatically by make targets)

### TypeScript/JavaScript
- **Indentation:** 4 spaces (2 spaces for `package.json`, `.eslintrc.json`, i18n files)
- **Linting:** ESLint with `@mattermost/eslint-plugin` (custom plugin in `webapp/platform/eslint-plugin`)
- **Style:** stylelint for SCSS/CSS
- **Line endings:** LF
- **Trailing whitespace:** Trimmed (except `.md` files)

### EditorConfig
The project uses `.editorconfig` with specific rules per file type:
- Go/SQL: tabs
- JS/TS/JSON/HTML: 4 spaces (2 for package.json, i18n)
- SCSS: 4 spaces
- YAML: 2 spaces
- Makefile: tabs

## Testing Conventions

### Go Tests
- Uses `gotestsum` for test running with JUnit output
- Test packages use `testlib` for test helpers
- Store tests use mocks from `channels/store/storetest/mocks`
- Set `MM_SERVER_PATH` env var when running tests outside Makefile

### Jest Tests
- Runs with `TZ=Etc/UTC` for timezone consistency
- Uses `@testing-library/react` and Enzyme
- Snapshot testing available via `test:updatesnapshot`

## Project-Specific Patterns

### Database Migrations
- Located in `server/channels/db/migrations/`
- Must create both MySQL AND PostgreSQL versions (use `make new-migration`)
- Uses `morph` migration tool

### Store Layer Architecture
- Store interfaces defined in `channels/store/store.go`
- Generated layers via `make store-layers`
- Implements caching and metrics layers automatically

### i18n (Internationalization)
- Go i18n: Uses `mmgotool` (in `tools/mmgotool/`)
- Webapp i18n: Uses `mmjstool` (npm package from mattermost-utilities repo)
- Translation files in `webapp/channels/src/i18n/`

### Plugin System
- Plugin API in `server/public/plugin/`
- Mock generation via `make plugin-mocks`
- Plugin packages defined in `server/Makefile` (PLUGIN_PACKAGES)

### Enterprise Features
- Enterprise code lives in separate `../enterprise` directory
- Enabled via `BUILD_ENTERPRISE=true` and presence of enterprise directory
- Conditional compilation using build tags: `//go:build enterprise`

## Common Gotchas

1. **Tests need Docker:** Running Go tests requires Docker services to be running first (use `make start-docker`)
2. **Webapp workspaces:** After `npm install` in webapp root, packages are built automatically via `postinstall` script
3. **Copyright headers:** Go files must include the exact Mattermost copyright header
4. **npmrc settings:** Uses `legacy-peer-deps=true` and `save-exact=true`
5. **Generated files:** Many files are auto-generated (mocks, layers, i18n) - don't edit directly
6. **Monorepo structure:** Go module is in `server/` subdirectory, not repository root
