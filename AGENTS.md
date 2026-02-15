# AGENTS.md

Instructions for AI coding agents working on the Mattermost repository.

## Project Overview

Mattermost is an open-source collaboration platform (team messaging, channels, threads, file sharing, integrations). This monorepo contains:

- **`server/`** -- Go backend (REST API, WebSocket, business logic, data persistence)
- **`webapp/`** -- React/TypeScript frontend (npm workspace monorepo)
- **`e2e-tests/`** -- End-to-end test suites (Playwright, Cypress)
- **`api/`** -- OpenAPI specification for the REST API

## Build and Run

### Prerequisites

- Go 1.24.13+
- Node.js 20+ / npm 10+
- PostgreSQL 14 (with database `mattermost_test`, user `mmuser`, password `mostest`)
- Redis

### Server

```bash
cd server
make run-server          # Start server (requires Docker for deps by default)
make cursor-cloud-run-server  # Start server without Docker (Cloud Agent env)
```

The server runs on `http://localhost:8065`.

### Webapp

```bash
cd webapp
npm install              # Install dependencies
make dev                 # Start webpack-dev-server with HMR
```

### Full Stack

```bash
cd server && make run    # Starts both server and webapp
```

## Testing

### Server (Go)

```bash
cd server
make test-server              # Full test suite (requires Docker)
make test-server-quick        # Quick tests (-short flag)
make cursor-cloud-test-server # Full tests without Docker (Cloud Agent env)

# Specific package:
cd server && go test -run TestName ./channels/app/
```

### Webapp (Jest)

```bash
cd webapp
make test                              # All tests
npm run test --workspace=channels      # Channels tests
npm run test:watch --workspace=channels # Watch mode
```

### E2E (Playwright)

```bash
cd e2e-tests/playwright
npx playwright test
npx playwright test --grep "pattern"
```

### Linting and Types

```bash
# Server
cd server && make check-style   # golangci-lint + go vet

# Webapp
cd webapp && make check-style   # ESLint
cd webapp && make check-types   # TypeScript
cd webapp && make fix-style     # Auto-fix
```

## Architecture

### Server (`server/`)

The backend follows a layered architecture:

```
HTTP Request -> api4/ -> app/ -> store/ -> sqlstore/ -> PostgreSQL
```

| Layer | Directory | Description |
|-------|-----------|-------------|
| **Entry point** | `cmd/mattermost/` | Server binary, CLI commands |
| **CLI tool** | `cmd/mmctl/` | Admin CLI (`mmctl`) |
| **API handlers** | `channels/api4/` | REST endpoint implementations. Each handler validates input, calls the app layer, and returns JSON. |
| **App layer** | `channels/app/` | Core business logic. Orchestrates stores, plugins, notifications, permissions. This is where most feature logic lives. |
| **Store** | `channels/store/` | Data persistence interface. Defines `Store` interface with sub-stores (`UserStore`, `ChannelStore`, `PostStore`, etc.). |
| **SQL store** | `channels/store/sqlstore/` | PostgreSQL implementations using the Squirrel query builder. |
| **Web/routing** | `channels/web/` | HTTP router setup, static file serving, OAuth/SAML handlers. |
| **WebSocket** | `channels/wsapi/` | WebSocket event handlers for real-time messaging. |
| **Jobs** | `channels/jobs/` | Background workers (exports, data retention, migrations, notifications). |
| **Public API** | `public/model/` | Shared data types (User, Channel, Post, Team, etc.). Used by server, webapp types, and plugins. |
| **Plugin SDK** | `public/plugin/` | Plugin interface definitions and helpers. |
| **Enterprise interfaces** | `einterfaces/` | Interfaces for enterprise features (LDAP, SAML, compliance). Implementations live in the separate `mattermost/enterprise` repo. |
| **Platform services** | `platform/services/` | Shared services: cache, search engine, remote cluster, telemetry. |
| **Platform shared** | `platform/shared/` | Shared libraries: filestore, email, MFA, templates. |

**Key patterns:**
- API handlers in `api4/` call methods on `app.App` (the app layer)
- App methods call store methods via the `store.Store` interface
- Store uses a decorator pattern: Timer -> Retry -> Cache -> Search -> SQL
- Data model types are in `public/model/` and shared across server + plugins
- Enterprise features use the `einterfaces` package for interface definitions; implementations are in a separate private repo
- Build tags (`enterprise`, `sourceavailable`) control conditional compilation

### Webapp (`webapp/`)

An npm workspace monorepo with React 18 + Redux + TypeScript.

| Package | Directory | Description |
|---------|-----------|-------------|
| **channels** | `channels/` | Main app: all UI components, Redux logic, routing |
| **@mattermost/types** | `platform/types/` | Shared TypeScript type definitions |
| **@mattermost/client** | `platform/client/` | REST + WebSocket client for the Mattermost API |
| **@mattermost/components** | `platform/components/` | Shared React components |
| **@mattermost/eslint-plugin** | `platform/eslint-plugin/` | Custom ESLint rules |

**Channels app structure (`channels/src/`):**

| Directory | Description |
|-----------|-------------|
| `components/` | React components organized by feature (300+ directories) |
| `actions/` | Redux action creators (sync and async thunks) |
| `selectors/` | Redux selectors for deriving state from store |
| `reducers/` | Redux reducers for state management |
| `store/` | Redux store setup with redux-persist |
| `utils/` | Utility functions |
| `i18n/` | Internationalization locale files |
| `sass/` | SCSS global styles and theme variables |
| `types/` | App-specific TypeScript types |
| `plugins/` | Plugin integration points |
| `packages/mattermost-redux/` | Core Redux logic (actions, reducers, selectors for server entities) |

**Key patterns:**
- Components never call the API client directly; all data fetching goes through Redux actions
- `state.entities.*` holds server-sourced data (users, channels, posts); `state.views.*` holds UI state
- Use `useSelector`/`useDispatch` hooks, not the legacy `connect` HOC
- All UI text must be internationalized with React Intl (`<FormattedMessage>`)
- Import platform packages by name (`@mattermost/client`), never by relative path
- Use `renderWithContext` from `tests/react_testing_utils` for component tests

### E2E Tests (`e2e-tests/`)

- **Playwright** (`playwright/`): Primary E2E framework. Tests in `specs/`. Config in `playwright.config.ts`.
- **Cypress** (`cypress/`): Legacy framework, being migrated to Playwright.

## Code Generation

```bash
cd server
make mocks                 # Regenerate all mock files
make store-mocks           # Store interface mocks only
make store-layers          # Generate store layer wrappers
make new-migration name=x  # Create new DB migration
make pluginapi             # Regenerate plugin API glue
make gen-serialized        # Regenerate msgpack serialization
```

## Code Style

### Server (Go)

- Follow standard Go conventions
- Use structured logging (`mlog` package) -- never `fmt.Println` or `log.Printf`
- Use `model.NewId()` for generating IDs
- Error types: `store.ErrNotFound`, `store.ErrConflict`, `model.AppError`
- Receiver naming: be consistent within a file
- All strings must be translatable (use `i18n` IDs)
- Run `make vet` for Mattermost-specific Go vet checks

### Webapp (TypeScript/React)

- See `webapp/STYLE_GUIDE.md` for full guidelines
- Functional components with hooks (no new class components)
- SCSS with CSS variables and BEM naming
- React Testing Library for tests (no Enzyme, no snapshots)
- `userEvent` over `fireEvent` in tests
- Accessible selectors: `getByRole` > `getByText` > `getByLabelText` > `getByTestId`

## Database

- PostgreSQL 14 (primary and only supported production database)
- Connection: `postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable`
- Migrations: `server/channels/db/migrations/postgres/`
- Query builder: Squirrel (used in `sqlstore/`)

## Common Pitfalls

- **Docker dependency**: Many standard `make` targets call `make start-docker`. In environments without Docker, use `cursor-cloud-*` targets or set `MM_NO_DOCKER=true`.
- **go.work**: Run `make setup-go-work` after checking out the repo or changing enterprise presence.
- **Webapp platform packages**: These are built automatically on `npm install`. If types seem stale, rebuild with `npm run build --workspace=@mattermost/types`.
- **Adding npm dependencies**: Always use `--workspace=channels` (or the relevant workspace).
- **Store interface changes**: After modifying `store/store.go`, regenerate mocks with `make store-mocks` and layers with `make store-layers`.
- **Enterprise features**: The `mattermost/enterprise` repo is private. Without it, the server builds as the community ("team") edition. Enterprise interfaces are in `einterfaces/`.
- **Test database**: Server tests expect `mattermost_test` database. Set `MM_SQLSETTINGS_DATASOURCE` if using a non-default connection.

## Default Dev Credentials

- **Admin user**: `sysadmin` / `Sys@dmin-sample1` (after running `make inject-test-data`)
- **Regular user**: `user-1` / `SampleUs@r-1` (after running `make inject-test-data`)
- **Database**: `mmuser` / `mostest`
