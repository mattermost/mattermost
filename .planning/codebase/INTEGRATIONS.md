# External Integrations

**Analysis Date:** 2026-01-13

## APIs & External Services

**Content Discovery:**
- Giphy - GIF search and sharing
  - SDK/Client: `@giphy/js-fetch-api 5.7.0`, `@giphy/react-components 10.1.0` - `webapp/channels/package.json`
  - Auth: API key configured in system settings

**AI Integration:**
- Mattermost AI Plugin
  - Package: `github.com/mattermost/mattermost-plugin-ai v1.5.0` - `server/go.mod`
  - Purpose: AI-powered features and chat assistance

**API Documentation:**
- Redocly & Swagger
  - Tools: `@redocly/cli ^1.13.0`, `swagger-cli 4.0.4` - `api/package.json`
  - OpenAPI specs: `api/v4/source/` - REST API documentation

## Data Storage

**Databases:**
- PostgreSQL (primary recommended)
  - Driver: `github.com/lib/pq v1.10.9` - `server/go.mod`
  - ORM: `github.com/jmoiron/sqlx v1.4.0` - `server/go.mod`
  - Query builder: `github.com/mattermost/squirrel v0.5.0` - `server/go.mod`
  - Migrations: `github.com/mattermost/morph v1.1.0` - `server/go.mod`
  - Connection: `MM_SQLSETTINGS_DATASOURCE` env var

- MySQL (alternative)
  - Driver: `github.com/go-sql-driver/mysql v1.9.3` - `server/go.mod`
  - Connection: Same DSN pattern as PostgreSQL

- SQLite (development/embedded)
  - Driver: `github.com/mattn/go-sqlite3 v2.0.3`, `modernc.org/sqlite v1.39.1` - `server/go.mod`
  - Purpose: Local development and testing

**File Storage:**
- MinIO/S3-compatible
  - SDK/Client: `github.com/minio/minio-go/v7 v7.0.95` - `server/go.mod`
  - AWS SDK: `github.com/aws/aws-sdk-go-v2 v1.39.6` - `server/go.mod`
  - Purpose: User uploads, attachments, file storage
  - Auth: IAM credentials or MinIO access keys

**Search & Indexing:**
- Elasticsearch
  - Client: `github.com/elastic/go-elasticsearch/v8 v8.19.0` - `server/go.mod`
  - Connection: `MM_ELASTICSEARCHSETTINGS_CONNECTIONURL`

- OpenSearch (alternative)
  - Client: `github.com/opensearch-project/opensearch-go/v4 v4.5.0` - `server/go.mod`
  - Purpose: Full-text search for messages and files

**Caching:**
- Redis
  - Client: `github.com/redis/rueidis v1.0.67`, `github.com/redis/go-redis/v9 v9.14.0` - `server/go.mod`
  - Purpose: Session storage, caching, pub/sub for clustering

## Authentication & Identity

**Auth Provider:**
- Built-in email/password authentication
  - JWT: `github.com/golang-jwt/jwt/v5 v5.3.0` - `server/go.mod`
  - Token storage: httpOnly cookies
  - Session management: Database-backed with Redis option

**Enterprise SSO:**
- SAML 2.0
  - Package: `github.com/mattermost/gosaml2 v0.10.0` - `server/go.mod`
  - Purpose: Enterprise identity provider integration

- LDAP/AD
  - Package: `github.com/mattermost/ldap v0.0.0-20231116144001-0f480c025956` - `server/go.mod`
  - Purpose: Directory synchronization and authentication

**OAuth Integrations:**
- OAuth 2.0 provider support
  - Built-in OAuth server for apps/integrations
  - External OAuth client for SSO (GitLab, Google, Office 365)

**Two-Factor Authentication:**
- Google Authenticator
  - Package: `github.com/dgryski/dgoogauth v0.0.0-20190221195224-5a805980a5f3` - `server/go.mod`

## Monitoring & Observability

**Error Tracking:**
- Sentry
  - SDK: `github.com/getsentry/sentry-go v0.36.0` - `server/go.mod`
  - Purpose: Error reporting and crash tracking

**Metrics:**
- Prometheus
  - Client: `github.com/prometheus/client_golang v1.23.2` - `server/go.mod`
  - Models: `github.com/prometheus/client_model v0.6.2` - `server/go.mod`
  - Purpose: Application metrics and performance monitoring

**Logging:**
- Structured logging
  - Package: `github.com/mattermost/logr/v2 v2.0.22`, `github.com/sirupsen/logrus v1.9.3` - `server/go.mod`
  - Format: JSON structured logs to stdout

## CI/CD & Deployment

**Hosting:**
- Docker containers
  - Compose files: `server/docker-compose.yaml`, `server/docker-compose.makefile.yml`
  - Purpose: Development and production deployments

**CI Pipeline:**
- GitHub Actions
  - Workflows: `.github/workflows/` (server-ci.yml, webapp-ci.yml)
  - Tests: Unit, integration, E2E (Playwright)
  - Secrets: GitHub repository secrets

**Test Management:**
- Zephyr (Jira Test Management)
  - Integration: `.github/actions/save-junit-report-tms/`
  - Environment: `INPUT_ZEPHYR-API-KEY`, `INPUT_JIRA-PROJECT-KEY=MM`
  - Purpose: Test result reporting to Jira

**Visual Testing:**
- Percy
  - Token: `PERCY_TOKEN` env var
  - Enable: `PW_PERCY_ENABLE=true`
  - Purpose: Visual regression testing in E2E

## Environment Configuration

**Development:**
- Required env vars: `MM_SQLSETTINGS_DATASOURCE`, `MM_SERVICESETTINGS_SITEURL`
- Secrets location: `.env.local` (gitignored), team vault
- Docker Compose for local services: PostgreSQL, Redis, Inbucket (email)

**Testing:**
- Test environment: `server/build/dotenv/test.env`
- Inbucket for email: `MM_EMAILSETTINGS_SMTPSERVER=inbucket`
- Playwright: `PW_BASE_URL`, `PW_ADMIN_USERNAME`, `PW_ADMIN_PASSWORD`

**Production:**
- Secrets management: Environment variables, Kubernetes secrets
- Database: PostgreSQL with connection pooling
- High availability: Redis for session sharing across nodes

## Webhooks & Callbacks

**Incoming:**
- Incoming webhooks - `/hooks/{hook_id}`
  - Purpose: External services posting messages to channels
  - Verification: Token-based authentication

- Slash commands - `/api/v4/commands/execute`
  - Purpose: Custom command handlers
  - Verification: Token verification

**Outgoing:**
- Outgoing webhooks - Configured per channel
  - Purpose: Post events to external services
  - Events: New messages matching trigger words/patterns

- Interactive messages - Button/menu callbacks
  - Purpose: User interaction responses to external apps

## Content Processing

**Document Conversion:**
- Package: `code.sajari.com/docconv/v2 v2.0.0-pre.4` - `server/go.mod`
- Formats: PDF, DOCX, XLSX, PPTX, and more

**PDF Processing:**
- Package: `github.com/ledongthuc/pdf v0.0.0-250511090121-5959a4027728` - `server/go.mod`

**Markdown:**
- Server: `github.com/yuin/goldmark v1.7.13` - `server/go.mod`
- Client: `github:mattermost/marked#e4a8785` - `webapp/channels/package.json`

**HTML Sanitization:**
- Package: `github.com/microcosm-cc/bluemonday v1.0.27` - `server/go.mod`

## AWS Services

**Core SDK:**
- `github.com/aws/aws-sdk-go-v2 v1.39.6` - `server/go.mod`
- `github.com/aws/aws-sdk-go-v2/config v1.29.14`
- `github.com/aws/aws-sdk-go-v2/credentials v1.17.67`

**Marketplace:**
- `github.com/aws/aws-sdk-go-v2/service/marketplacemetering v1.34.4`
- Purpose: AWS Marketplace billing integration

---

*Integration audit: 2026-01-13*
*Update when adding/removing external services*
