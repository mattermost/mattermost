# Webhook Server Redesign Plan (Archived)

> **Status:** Archived — this was the original design plan. The implementation diverged in several ways:
>
> - **Express 5.2.1** is used instead of zero-dependency `node:http`
> - **TypeScript** (`.ts`) instead of plain JavaScript (`.js`)
> - **Dynamic route registration** (`POST /register`) instead of `config/services.json`
> - **Vite** build toolchain instead of direct `node server.js`
> - **OAuth** and **datetime-specific** handlers were not implemented
>
> See `README.md` for the current architecture and `docs/` for usage and expansion guides.

## Original Goal

Redesign the Cypress webhook server (`cypress/webhook_serve.js`) into a shared, config-driven webhook service usable by both Cypress and Playwright test suites.

## What Was Implemented

### From the Original Plan
- Shared location at `e2e-tests/webhook-server/`
- Config-driven dialog templates in `config/dialogs.json`
- Handler separation: `handlers/` and `lib/` directories
- Native `fetch` for HTTP client (replaces axios)
- Shared context object (replaces module-level globals)
- Self-describing service catalog via `GET /`
- Hyphenated URL paths with underscore backward compatibility
- Docker-ready deployment

### Changed from the Original Plan
- Express 5.2.1 used for routing/middleware instead of custom `node:http` router
- TypeScript with Vite build instead of plain JavaScript
- Dynamic route registration via `POST /register` instead of static `config/services.json`
- `npm install` required (Express dependency)

### Not Implemented
- OAuth2 flow (`oauth-credentials`, `oauth-start`, `oauth-complete`, `oauth-message`)
- DateTime-specific handlers (`datetime-dialog-request`, `datetime-dialog-submit`)
- Dynamic select source handler
- Field refresh source handler
- `config/services.json` service catalog file
