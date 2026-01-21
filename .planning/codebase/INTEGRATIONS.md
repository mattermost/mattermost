# External Integrations

**Analysis Date:** 2026-01-21

## APIs & External Services

**AI/LLM Services (Recap Feature):**
- Mattermost AI Plugin (`mattermost-ai`) - AI agent for summarization
  - SDK/Client: `github.com/mattermost/mattermost-plugin-ai/public/bridgeclient`
  - Integration: `server/channels/app/agents.go`, `server/channels/app/summarization.go`
  - Minimum version: 1.5.0 (for bridge API support)
  - Features: Agent completion API for post summarization, agent listing
  - Auth: Plugin-to-server communication (internal)

**Feature Flags:**
- Split.io - Feature flag management
  - SDK/Client: `github.com/splitio/go-client/v6`
  - Integration: `server/channels/app/featureflag/feature_flags_sync.go`
  - Auth: `SplitKey` configuration parameter
  - Key recap flag: `EnableAIRecaps`

**Marketplace/AWS:**
- AWS Marketplace Metering
  - SDK/Client: `github.com/aws/aws-sdk-go-v2/service/marketplacemetering`
  - Purpose: Usage metering for AWS Marketplace deployments

## Data Storage

**Databases:**
- PostgreSQL (primary)
  - Driver: `github.com/lib/pq`
  - ORM/Query Builder: `github.com/jmoiron/sqlx`, `github.com/mattermost/squirrel`
  - Migrations: `github.com/golang-migrate/migrate/v4`, `github.com/mattermost/morph`
  - Connection: `DataSource` in config
  - Recap tables: `Recaps`, `RecapChannels` (see `server/channels/db/migrations/postgres/000149_create_recaps.up.sql`)

- MySQL (supported alternative)
  - Driver: `github.com/go-sql-driver/mysql`

- SQLite (development/testing)
  - Driver: `modernc.org/sqlite`

**File Storage:**
- Local filesystem - Default for development
  - Implementation: `server/platform/shared/filestore/localstore.go`

- S3-compatible storage - Production
  - Client: `github.com/minio/minio-go/v7`
  - Implementation: `server/platform/shared/filestore/s3store.go`
  - Supports: AWS S3, MinIO, DigitalOcean Spaces, etc.
  - Config: `FileSettings.DriverName`, `FileSettings.AmazonS3*`

**Caching:**
- Redis (optional, for clustering/performance)
  - Client: `github.com/redis/rueidis`
  - Implementation: `server/platform/services/cache/redis.go`
  - Alternative: In-memory LRU cache (`server/platform/services/cache/lru.go`)

## Search

**Elasticsearch:**
- Client: `github.com/elastic/go-elasticsearch/v8`
- Implementation: `server/enterprise/elasticsearch/elasticsearch/`
- Purpose: Full-text search for messages, files

**OpenSearch:**
- Client: `github.com/opensearch-project/opensearch-go/v4`
- Implementation: `server/enterprise/elasticsearch/opensearch/`
- Purpose: Alternative to Elasticsearch

## Authentication & Identity

**Built-in Auth:**
- Email/password authentication
- Session-based authentication with tokens
- MFA support (`github.com/dgryski/dgoogauth`)

**LDAP/AD:**
- Client: `github.com/mattermost/ldap`
- Implementation: `server/channels/app/ldap.go`
- Purpose: Directory integration, user sync

**SAML 2.0:**
- Client: `github.com/mattermost/gosaml2`
- Purpose: SSO integration with identity providers

**OAuth 2.0:**
- Implementation: Custom OAuth provider support
- Purpose: SSO, third-party authentication

**JWT:**
- Library: `github.com/golang-jwt/jwt/v5`
- Purpose: Token-based authentication, API access

## Monitoring & Observability

**Metrics:**
- Prometheus
  - Client: `github.com/prometheus/client_golang`
  - Implementation: `server/enterprise/metrics/`
  - Purpose: Application metrics, performance monitoring

**Error Tracking:**
- Sentry
  - Client: `github.com/getsentry/sentry-go`
  - Purpose: Error reporting, crash analytics

**Logging:**
- Custom logger: `github.com/mattermost/logr/v2`
- Syslog support: `github.com/wiggin77/srslog`
- Log rotation: `gopkg.in/natefinch/lumberjack.v2`

## Notifications

**Email:**
- SMTP integration via `gopkg.in/mail.v2`
- Config: `EmailSettings` (SMTPServer, SMTPPort, etc.)
- Implementation: `server/channels/app/config.go` (email service config)

**Push Notifications:**
- Custom push notification server integration
- Implementation: `server/channels/app/notification_push.go`
- Protocol: HTTP-based push proxy

**WebSockets:**
- Real-time updates via Gorilla WebSocket
- Implementation: `github.com/gorilla/websocket`
- Recap events: `WebsocketEventRecapUpdated` for live status updates

## CI/CD & Deployment

**Hosting:**
- Self-hosted (primary deployment model)
- Cloud deployments (AWS, Azure, GCP)
- Kubernetes support

**CI Pipeline:**
- GitHub Actions (`.github/` directory)
- E2E tests: Cypress, Playwright (`e2e-tests/`)

## Webhooks & Integrations

**Incoming Webhooks:**
- Custom message posting via HTTP
- Implementation: `server/channels/app/webhook.go`

**Outgoing Webhooks:**
- Event-triggered HTTP callbacks
- Config: `ServiceSettings.EnableOutgoingWebhooks`
- OAuth connection support for authenticated webhooks

**Slash Commands:**
- Custom command integration
- Implementation: `server/channels/app/command.go`

## Recap-Specific Integrations

**AI Plugin Bridge:**
- Purpose: Communication between Mattermost server and AI plugin
- Client: `agentclient.Client` from `github.com/mattermost/mattermost-plugin-ai/public/bridgeclient`
- Methods:
  - `GetAgents(userID)` - List available AI agents
  - `GetServices(userID)` - List LLM services
  - `AgentCompletion(agentID, request)` - Generate AI completions
- Integration points:
  - `server/channels/app/agents.go` - Agent management
  - `server/channels/app/summarization.go` - Post summarization with AI

**Background Jobs:**
- Job system for async processing
- Recap worker: `server/channels/jobs/recap/worker.go`
- Job type: `model.JobTypeRecap`
- Progress tracking via WebSocket events

## Environment Configuration

**Required env vars (minimal):**
- Database connection (via config.json or env)
- Site URL configuration

**Optional env vars:**
- `MM_SQLSETTINGS_DATASOURCE` - Database connection string
- `MM_FILESETTINGS_*` - File storage configuration
- `MM_EMAILSETTINGS_*` - SMTP configuration
- `MM_SERVICESETTINGS_SITEURL` - Base URL for the server

**Secrets location:**
- `config.json` - Primary configuration file
- Environment variables - Override config values
- Encrypted at-rest options available

**Recap-specific configuration:**
- Feature flag: `FeatureFlags.EnableAIRecaps` (boolean)
- Requires: AI plugin installed and active (version >= 1.5.0)

## Third-Party Plugin Ecosystem

**Plugin Architecture:**
- Plugins run as subprocesses
- Communication via `github.com/hashicorp/go-plugin`
- Hook system for extending functionality

**Key Plugin for Recaps:**
- `mattermost-ai` plugin (ID: `mattermost-ai`)
- Provides: AI agents, LLM services, completion API
- Required for: Recap summarization feature

---

*Integration audit: 2026-01-21*
