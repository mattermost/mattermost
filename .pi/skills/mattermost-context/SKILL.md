---
description: Mattermost server codebase context — Go monorepo with webapp, server, and plugin system
---

# Mattermost Server Context

## Architecture
- Go monorepo: `server/` (Go backend) + `webapp/` (React frontend)
- Plugin system: server hooks + webapp components
- Database: PostgreSQL + MySQL support via abstracted store layer
- Real-time: WebSocket for live updates

## Key Directories
- `server/channels/` — Core business logic (teams, channels, posts, users)
- `server/cmd/` — CLI commands
- `server/config/` — Configuration management
- `server/client/` — Go API client
- `webapp/channels/` — React webapp
- `webapp/platform/` — Shared platform code
- `e2e-tests/` — Cypress/Playwright E2E tests

## Review Patterns
- Check `model.NewAppError` for proper error wrapping
- Check store layer for SQL safety (squirrel query builder)
- Check plugin hooks: backward compatibility is critical
- Check API handlers: auth middleware, proper permissions checks
- Check webapp: Redux patterns, i18n (all strings via intl)
- Migrations must be reversible (up + down)

## Testing
- `cd server && make test` — unit tests
- `cd server && make test-short` — fast subset
- `cd e2e-tests && npm test` — E2E
