# Technology Stack

**Analysis Date:** 2026-01-21

## Languages

**Primary:**
- Go 1.24.11 - Backend server, API, jobs, business logic
- TypeScript 5.6.3 - Frontend webapp, types, client SDK

**Secondary:**
- JavaScript - Legacy frontend code, build scripts
- SCSS/CSS - Frontend styling
- SQL (PostgreSQL) - Database migrations

## Runtime

**Environment:**
- Node.js ^20 || ^22 || ^24 (webapp)
- Go 1.24.11 (server)

**Package Manager:**
- npm ^10 || ^11 (webapp)
- Go modules (server)
- Lockfile: package-lock.json (present), go.sum (present)

## Frameworks

**Core:**
- React 18.2.0 - Frontend UI framework
- Redux 5.0.1 - Frontend state management (with redux-thunk, redux-persist)
- Gorilla Mux - Go HTTP router (`github.com/gorilla/mux`)
- Gorilla WebSocket - Real-time communication (`github.com/gorilla/websocket`)

**Testing:**
- Jest 30.1.3 - Frontend unit/integration testing
- Go testing - Backend unit/integration testing
- Cypress - E2E testing (browser automation)
- Playwright - E2E testing (cross-browser)

**Build/Dev:**
- Webpack 5.103.0 - Frontend bundling
- Babel 7.28.5 - JavaScript/TypeScript transpilation
- ESLint 8.57.0 - Frontend linting
- Stylelint 16.10.0 - CSS/SCSS linting

## Key Dependencies

**Critical:**
- `react-redux` 9.2.0 - Redux bindings for React
- `react-router-dom` 5.3.4 - Client-side routing
- `react-intl` 7.1.14 - Internationalization
- `@mattermost/compass-icons` 0.1.52 - Icon library

**Infrastructure:**
- `github.com/lib/pq` - PostgreSQL driver
- `github.com/jmoiron/sqlx` - SQL extensions for Go
- `github.com/mattermost/squirrel` - SQL query builder
- `github.com/golang-migrate/migrate/v4` - Database migrations
- `github.com/redis/rueidis` - Redis client (caching)
- `github.com/minio/minio-go/v7` - S3-compatible object storage
- `github.com/prometheus/client_golang` - Prometheus metrics
- `github.com/getsentry/sentry-go` - Error tracking

**Recap-Specific:**
- `github.com/mattermost/mattermost-plugin-ai` - AI plugin bridge client for LLM integration
  - Location: `server/channels/app/summarization.go`, `server/channels/app/agents.go`
  - Used for: AI-powered post summarization via agent completion API

## Configuration

**Environment:**
- Configuration via `config.json` at `server/config/config.json`
- Environment variable overrides supported
- Feature flags via Split.io (`github.com/splitio/go-client/v6`)
  - Key flag for recaps: `EnableAIRecaps` (see `server/public/model/feature_flags.go`)

**Build:**
- `webpack.config.js` - Frontend build configuration
- `go.mod` - Go module definition at `server/go.mod`
- `package.json` - NPM workspace configuration at `webapp/package.json`
- `tsconfig.json` - TypeScript configuration

## Monorepo Structure

**Workspaces (npm):**
- `webapp/channels` - Main web application
- `webapp/platform/client` - HTTP/API client SDK
- `webapp/platform/components` - Shared React components
- `webapp/platform/types` - TypeScript type definitions
- `webapp/platform/mattermost-redux` - Redux actions, reducers, selectors
- `webapp/platform/eslint-plugin` - Custom ESLint rules

**Go Modules:**
- `server/` - Main server module (`github.com/mattermost/mattermost/server/v8`)
- `server/public/` - Public API module (`github.com/mattermost/mattermost/server/public`)

## Recap Subsystem Stack

**Frontend:**
- React components: `webapp/channels/src/components/recaps/`
- Redux state: `webapp/channels/src/packages/mattermost-redux/src/reducers/entities/recaps.ts`
- Redux actions: `webapp/channels/src/packages/mattermost-redux/src/actions/recaps.ts`
- Redux selectors: `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/recaps.ts`
- Type definitions: `webapp/platform/types/src/recaps.ts`
- Client API: `webapp/platform/client/src/client4.ts` (getRecapsRoute, createRecap, etc.)

**Backend:**
- API handlers: `server/channels/api4/recap.go`
- Business logic: `server/channels/app/recap.go`
- AI summarization: `server/channels/app/summarization.go`
- Data model: `server/public/model/recap.go`
- Store layer: `server/channels/store/sqlstore/recap_store.go`
- Background job: `server/channels/jobs/recap/worker.go`
- Database migrations: `server/channels/db/migrations/postgres/000149_create_recaps.up.sql`

**WebSocket:**
- Event type: `WebsocketEventRecapUpdated` (see `server/public/model/websocket_message.go`)

## Platform Requirements

**Development:**
- Node.js 20+ 
- Go 1.24+
- PostgreSQL 12+ (primary database)
- Make (build automation)
- Docker (optional, for local services)

**Production:**
- PostgreSQL database
- S3-compatible storage (optional)
- Redis (optional, for caching/clustering)
- Push notification server (optional)

---

*Stack analysis: 2026-01-21*
