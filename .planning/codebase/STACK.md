# Technology Stack

**Analysis Date:** 2026-01-13

## Languages

**Primary:**
- Go 1.24.11 - Backend server, CLI tools, plugin system - `server/go.mod`
- TypeScript 5.6.3 - Frontend web application - `webapp/package.json`, `webapp/channels/tsconfig.json`

**Secondary:**
- JavaScript - Build scripts, config files, legacy components
- SCSS/CSS - Styling - `webapp/channels/src/sass/`
- YAML - Configuration and CI/CD - `.github/workflows/`, `server/docker-compose.yaml`
- SQL - Database migrations - `server/channels/db/migrations/`

## Runtime

**Environment:**
- Go 1.24.11 - Backend server runtime - `server/go.mod`
- Node.js >=18.10.0 - Frontend development and build - `webapp/package.json` (engines field)

**Package Manager:**
- npm >=9.0.0 <12.0.0 - Frontend packages with workspaces - `webapp/package.json`
- Go modules - Backend dependencies - `server/go.mod`, `server/go.sum`
- Lockfile: `package-lock.json` (webapp), `go.sum` (server)

**Workspaces (npm):**
- `webapp/channels` - Main web application
- `webapp/platform/client` - Reusable API client SDK
- `webapp/platform/components` - Shared UI components
- `webapp/platform/types` - TypeScript type definitions
- `webapp/platform/mattermost-redux` - Redux utilities
- `webapp/platform/eslint-plugin` - Custom ESLint rules

## Frameworks

**Core:**
- React 18.2.0 - UI framework - `webapp/channels/package.json`
- Redux 5.0.1 + React-Redux 9.2.0 - State management - `webapp/channels/package.json`
- Gorilla Mux - HTTP routing (Go) - `server/go.mod`
- Gorilla WebSocket - Real-time communication - `server/go.mod`

**Testing:**
- Jest 30.1.3 - Frontend unit tests - `webapp/channels/package.json`
- React Testing Library 16.3.0 - Component testing - `webapp/channels/package.json`
- Playwright 1.57.0 - E2E tests - `e2e-tests/playwright/package.json`
- Cypress - Legacy E2E tests - `e2e-tests/cypress/package.json`
- Go testing package - Backend unit/integration tests

**Build/Dev:**
- Webpack 5.95.0 - Frontend bundling - `webapp/channels/webpack.config.js`
- Babel 7.22.0 - JavaScript transpilation - `webapp/channels/babel.config.js`
- TypeScript 5.6.3 - Type checking and compilation - `webapp/channels/tsconfig.json`
- Make - Build orchestration - `server/Makefile`, `webapp/Makefile`

## Key Dependencies

**Critical (Backend):**
- `github.com/lib/pq v1.10.9` - PostgreSQL driver - `server/go.mod`
- `github.com/go-sql-driver/mysql v1.9.3` - MySQL driver - `server/go.mod`
- `github.com/mattermost/squirrel v0.5.0` - SQL query builder - `server/go.mod`
- `github.com/redis/rueidis v1.0.67` - Redis client - `server/go.mod`
- `github.com/elastic/go-elasticsearch/v8 v8.19.0` - Elasticsearch client - `server/go.mod`
- `github.com/minio/minio-go/v7 v7.0.95` - S3-compatible storage - `server/go.mod`
- `github.com/golang-jwt/jwt/v5 v5.3.0` - JWT authentication - `server/go.mod`
- `github.com/mattermost/gosaml2 v0.10.0` - SAML 2.0 SSO - `server/go.mod`

**Critical (Frontend):**
- `@mattermost/client 11.3.0` - API client SDK - `webapp/channels/package.json`
- `redux-thunk 3.1.0` - Async Redux actions - `webapp/channels/package.json`
- `@mui/material 5.11.16` - Material UI components - `webapp/channels/package.json`
- `styled-components 5.3.7` - CSS-in-JS - `webapp/channels/package.json`
- `luxon 3.6.1` - Date/time handling - `webapp/channels/package.json`
- `monaco-editor 0.52.2` - Code editor - `webapp/channels/package.json`

**Infrastructure:**
- `github.com/prometheus/client_golang v1.23.2` - Prometheus metrics - `server/go.mod`
- `github.com/getsentry/sentry-go v0.36.0` - Error tracking - `server/go.mod`
- `github.com/spf13/cobra v1.10.1` - CLI framework - `server/go.mod`
- `github.com/spf13/viper v1.21.0` - Configuration management - `server/go.mod`

## Configuration

**Environment:**
- Environment variables with `MM_` prefix - `server/build/dotenv/test.env`
- Database: PostgreSQL/MySQL DSN via `MM_SQLSETTINGS_DATASOURCE`
- Elasticsearch: `MM_ELASTICSEARCHSETTINGS_CONNECTIONURL`
- Email (testing): Inbucket via `MM_EMAILSETTINGS_SMTPSERVER`

**Build:**
- `server/config/` - Server configuration management
- `webapp/channels/webpack.config.js` - Webpack bundler config
- `webapp/channels/tsconfig.json` - TypeScript config
- `webapp/channels/babel.config.js` - Babel transpilation
- `.editorconfig` - Editor settings (Go: tabs, TS: 4 spaces)

**E2E Testing:**
- `PW_BASE_URL` - Server URL for Playwright tests
- `PW_ADMIN_USERNAME`, `PW_ADMIN_PASSWORD` - Test credentials
- `PERCY_TOKEN` - Visual regression testing

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node.js 18+ and Go 1.24+
- Docker for local services (PostgreSQL, Redis, Elasticsearch)
- Make for build orchestration

**Production:**
- PostgreSQL 12+ or MySQL 8.0+ (primary database)
- Redis (optional, for caching/clustering)
- Elasticsearch/OpenSearch (optional, for search)
- S3-compatible storage (optional, for file storage)
- SMTP server (for email notifications)

---

*Stack analysis: 2026-01-13*
*Update after major dependency changes*
