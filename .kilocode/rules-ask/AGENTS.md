# AGENTS.md - Ask Mode

This file provides documentation context for agents working in Ask mode in this repository.

## Documentation Structure

### Official Documentation
- **Product docs:** https://docs.mattermost.com/
- **Developer docs:** https://developers.mattermost.com/
- **API docs:** https://api.mattermost.com/

### Repository Documentation
- `README.md` - Project overview and installation
- `CONTRIBUTING.md` - Contribution guidelines
- `SECURITY.md` - Security policy and reporting
- `server/README.md` - Server-specific setup
- `webapp/README.md` - Webapp-specific setup
- `e2e-tests/README.md` - E2E testing documentation

## Code Organization

### Server (`server/`)
- `channels/` - Main Mattermost server code
  - `api4/` - REST API handlers
  - `app/` - Business logic (App layer)
  - `store/` - Database abstraction layer
  - `db/migrations/` - Database migrations
  - `jobs/` - Background job workers
  - `web/` - Web server and static files
- `platform/` - Platform services (shared components)
- `public/` - Public APIs (plugin API, model)
- `cmd/mattermost/` - Main entry point
- `cmd/mmctl/` - CLI tool

### Webapp (`webapp/`)
- `channels/` - Main web application
  - `src/` - Source code
  - `src/i18n/` - Translation files
  - `src/actions/` - Redux actions
  - `src/reducers/` - Redux reducers
  - `src/selectors/` - Redux selectors
  - `src/components/` - React components
- `platform/` - Shared platform packages
  - `client/` - API client library
  - `components/` - Shared UI components
  - `types/` - Shared TypeScript types
  - `eslint-plugin/` - Custom ESLint rules

### API (`api/`)
- OpenAPI v4 specification
- `v4/source/` - YAML API definitions
- `playbooks/` - API documentation tools

### Tools (`tools/`)
- `mmgotool/` - Go i18n extraction tool

## Common Questions

### "Where should I add a new API endpoint?"
Add to `server/channels/api4/` following existing patterns. Each file typically handles a resource (e.g., `teams.go`, `channels.go`).

### "Where is the database schema defined?"
- Current schema: `server/channels/store/sqlstore/` (look for `upgrade.go`)
- Migrations: `server/channels/db/migrations/`

### "Where are translations handled?"
- Go: `server/i18n/` (use `mmgotool` to extract)
- Webapp: `webapp/channels/src/i18n/` (use `npm run i18n-extract`)

### "Where are tests located?"
- Go: `*_test.go` files alongside source files
- Webapp: `*.test.tsx` alongside components or in `tests/` subdirectories
- E2E: `e2e-tests/cypress/tests/` or `e2e-tests/playwright/`

### "What is the store layer?"
The store layer is a database abstraction in `server/channels/store/`. It provides interfaces for data access with implementations for MySQL and PostgreSQL.

### "How do enterprise features work?"
Enterprise code lives in a separate `../enterprise` directory (sibling to this repo). It's conditionally compiled using Go build tags (`//go:build enterprise`).

### "What is the App layer?"
The App layer in `server/channels/app/` contains the core business logic. It sits between the API handlers and the store layer.

## Configuration Locations

- Server config: `server/config.mk` (create `config.override.mk` for local changes)
- Webapp config: `webapp/config.mk` (create `config.override.mk` for local changes)
- Docker services: `server/config.mk` - `ENABLED_DOCKER_SERVICES`
- Editor settings: `.editorconfig`
- ESLint: `webapp/channels/.eslintrc.json` (extends custom plugin)
