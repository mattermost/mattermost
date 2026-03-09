# Webhook Test Server — Specification

## 1. Purpose

The webhook test server is a standalone HTTP service that simulates external integrations during Mattermost E2E test automation. It acts as the backend for slash commands, interactive dialogs, outgoing webhooks, message menus, and OAuth flows.

It is shared by both Cypress and Playwright test suites.

## 2. Requirements

### 2.1 Functional Requirements

#### FR-001: Health Check
- The server must expose `GET /` returning a JSON response with server status and a list of all registered services.
- Each service entry must include the HTTP method, path, type, and description.

#### FR-002: Server Setup
- The server must expose `POST /setup` that stores Mattermost connection details (base URL, webhook base URL, admin username, admin password).
- All subsequent endpoints that interact with Mattermost depend on `/setup` having been called first.
- Must return HTTP 201 on success.

#### FR-003: Interactive Dialogs — Open
- The server must support opening interactive dialogs via the Mattermost `POST /api/v4/actions/dialogs/open` API.
- Dialog definitions are read from `config/dialogs.json`. Each dialog template includes: callback_id, title, submit_label, icon_url, elements, and optional state/introduction_text/source_url.
- Supported dialog types: full, simple, userAndChannel, boolean, multiselect, dynamicSelect, fieldRefresh, multistepStep1.
- The server must resolve `_submit_url_path`, `_source_url_path`, and `_data_source_url_path` placeholders in dialog configs to absolute URLs using the configured `webhookBaseUrl`.

#### FR-004: Interactive Dialogs — Submit
- The server must handle dialog form submissions at `POST /dialog-submit`.
- For cancelled dialogs (`body.cancelled === true`), it must post "Dialog cancelled" to the channel.
- For multistep dialogs (`callback_id === "multistep_callback"`), it must return the next step form based on `body.state` (step1 -> step2 -> step3 -> completion).
- For field refresh dialogs (`callback_id === "field_refresh_callback"`), it must post the submitted values.
- For regular dialogs, it must post "Dialog submitted" to the channel.
- Channel messages are posted via the Mattermost API using admin credentials from `/setup`.

#### FR-005: DateTime Dialogs
- The server must support datetime dialog variants selected by a subcommand in `body.text`: `basic`, `mindate`, `interval`, `relative`, `timezone-manual`, or default (basicDateTime).
- Submission handler must extract datetime field values and post a formatted confirmation message.

#### FR-006: Dynamic Select Source
- The server must return filtered options for dynamic select elements at `POST /dynamic-select-source`.
- Options are a static list of 12 engineering roles, filtered by `body.submission.query`.
- If no query, returns the first 6 options.

#### FR-007: Field Refresh Source
- The server must return an updated form definition at `POST /field-refresh-source` based on the selected `project_type`.
- When `project_type` is `web`, adds a Framework field. When `mobile`, adds a Platform field. When `api`, adds a Language field.

#### FR-008: Message Menus
- The server must respond to interactive message menu actions at `POST /message-menus`.
- When `body.context.action === "do_something"`, it must return an ephemeral message with the interaction details.

#### FR-009: Slack-Compatible Response
- The server must return a Slack-compatible ephemeral response at `POST /slack-compatible-response`.
- Must include `ephemeral_text` and `skip_slack_parsing` from the request context.

#### FR-010: Send Message to Channel
- The server must send a message with `extra_responses` to a specific channel at `POST /send-message-to-channel`.
- Channel ID and optional message type are passed as query parameters.

#### FR-011: Outgoing Webhook Response
- The server must respond to outgoing webhook triggers at `POST /post-outgoing-webhook`.
- Must echo back the received payload in a formatted markdown response.
- Must support query parameters: `override_username`, `override_icon_url`, `response_type`.

#### FR-012: OAuth2 Flow
- The server must support a complete OAuth2 authorization code flow:
  - `POST /send-oauth-credentials`: Store OAuth app credentials (client ID, secret).
  - `GET /start-oauth`: Redirect to Mattermost authorization endpoint.
  - `GET /complete-oauth`: Exchange authorization code for access token.
  - `POST /post-oauth-message`: Post a message using the stored OAuth access token.
- The OAuth flow must be implemented natively using `fetch` and `URLSearchParams` (no external OAuth library).

### 2.2 Non-Functional Requirements

#### NFR-001: Zero Dependencies
- The server must run with zero npm dependencies. Only Node.js built-in APIs are allowed (`node:http`, `fetch`, `URL`, `URLSearchParams`, `Buffer`, `crypto`).
- No `npm install` step is required to run the server.

#### NFR-002: Node.js Compatibility
- The server must run on Node.js >= 24.0.0 (per root `.nvmrc`).

#### NFR-003: Config-Driven
- New dialog types must be addable via JSON config only (no code changes) using `config/dialogs.json` and `config/services.json`.
- New endpoints using existing service types must be addable via JSON config only.

#### NFR-004: Backward Compatibility
- The server must accept URL paths with underscores (e.g., `/dialog_submit`) and normalize them to hyphens (`/dialog-submit`) for routing. This ensures existing Cypress tests work without modification.

#### NFR-005: Self-Describing
- Every service endpoint must have a description in `config/services.json`.
- The `GET /` endpoint must return the full service catalog.

#### NFR-006: Docker-Ready
- The server must run in a Docker container using `node:<version>-slim` image with a single volume mount and no build step.
- Health check must work without `curl` (use `node -e fetch(...)` instead).

#### NFR-007: Configurable Port
- The server port must be configurable via the `WEBHOOK_PORT` environment variable, defaulting to 3000.

## 3. Architecture

### 3.1 Component Diagram

```
config/services.json ─────┐
                           │
config/dialogs.json ───┐   │
                       │   ▼
                    server.js
                    ├── TYPE_HANDLERS mapping
                    ├── Loads services.json
                    └── Creates HTTP server
                           │
                    lib/router.js
                    ├── Path matching
                    ├── JSON body parsing
                    ├── Underscore normalization
                    └── Query param extraction
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        handlers/     lib/context.js  lib/http_client.js
        ├── ping.js                   ├── openDialog()
        ├── setup.js                  └── postAsAdmin()
        ├── dialog.js
        ├── message_menu.js
        ├── message.js
        ├── outgoing_webhook.js
        └── oauth.js
```

### 3.2 Request Flow

1. HTTP request arrives at `node:http` server
2. Router parses URL, extracts pathname, query params, and JSON body
3. Router looks up the route by `METHOD:path`. If not found, normalizes underscores to hyphens and retries.
4. Handler receives `{req, res, body, query, context, meta}`
5. Handler uses `meta.dialog` to look up dialog template (for `open-dialog` type)
6. Handler calls Mattermost API via `lib/http_client.js` if needed
7. Handler sends JSON response via `lib/router.js` helpers

### 3.3 Service Type System

The `type` field in `services.json` determines which handler processes the request. The mapping is defined in `server.js` as `TYPE_HANDLERS`. Service types are the public API — test authors pick from this list when adding endpoints.

| Type | Handler File | Handler Function |
|------|-------------|-----------------|
| `ping` | `ping.js` | `ping` |
| `setup` | `setup.js` | `setup` |
| `open-dialog` | `dialog.js` | `onOpenDialog` |
| `dialog-submit` | `dialog.js` | `onDialogSubmit` |
| `datetime-dialog-request` | `dialog.js` | `onDatetimeDialogRequest` |
| `datetime-dialog-submit` | `dialog.js` | `onDatetimeDialogSubmit` |
| `dynamic-select-source` | `dialog.js` | `onDynamicSelectSource` |
| `field-refresh-source` | `dialog.js` | `onFieldRefreshSource` |
| `message-menu` | `message_menu.js` | `messageMenu` |
| `slack-compatible-response` | `message.js` | `slackCompatibleResponse` |
| `send-to-channel` | `message.js` | `sendToChannel` |
| `outgoing-webhook-response` | `outgoing_webhook.js` | `outgoingWebhookResponse` |
| `oauth-credentials` | `oauth.js` | `oauthCredentials` |
| `oauth-start` | `oauth.js` | `oauthStart` |
| `oauth-complete` | `oauth.js` | `oauthComplete` |
| `oauth-message` | `oauth.js` | `oauthMessage` |

## 4. Configuration

### 4.1 services.json

Defines all HTTP endpoints. Each entry:

```json
{
    "path": "/dialog-request",
    "method": "POST",
    "type": "open-dialog",
    "dialog": "full",
    "description": "Opens the full interactive dialog."
}
```

- `path`: URL path (hyphenated)
- `method`: `GET` or `POST`
- `type`: Service type from the table above
- `dialog`: (optional) Key into `dialogs.json` for `open-dialog` type
- `description`: Human-readable description of what the endpoint does

### 4.2 dialogs.json

Defines dialog templates. Each entry is keyed by name and contains the Mattermost dialog structure:

```json
{
    "simple": {
        "callback_id": "somecallbackid",
        "title": "Title for Dialog Test without elements",
        "icon_url": "https://...",
        "submit_label": "Submit Test",
        "state": "somestate",
        "elements": []
    }
}
```

Special underscore-prefixed fields are resolved at runtime:
- `_submit_url_path`: Overrides the default submit URL (`/dialog-submit`)
- `_source_url_path`: Sets `dialog.source_url` for field refresh
- `_data_source_url_path` (on elements): Sets `data_source_url` for dynamic selects
- `_is_form_response`: Marks the dialog as a form response (for multistep navigation)
- `include_defaults_variant` (on multiselect): Maps element names to default values when `?includeDefaults=true`

## 5. Conventions

### 5.1 URL Paths
- Hyphenated: `/dialog-request`, `/send-message-to-channel`
- Backward compatibility: underscores are normalized to hyphens by the router

### 5.2 File Names
- Snake_case: `message_menu.js`, `http_client.js`, `outgoing_webhook.js`

### 5.3 Formatting and Linting
- oxfmt for formatting, oxlint for linting
- Run via `npx` (no package installation required)
- `npm run check` runs both

## 6. CI Integration

### 6.1 Docker Service

The server runs as `webhook-test-server` in Docker Compose, defined in `.ci/server.generate.sh`:

```yaml
webhook-test-server:
    image: node:<version>-slim
    command: node server.js
    healthcheck:
        test: ["CMD", "node", "-e", "fetch(...).then(...)"]
    working_dir: /webhook
    network_mode: host
    volumes:
        - "../../e2e-tests/webhook-server:/webhook:ro"
```

### 6.2 Service Enablement

The service is automatically enabled for both test types in `server.generate.sh`:
- `TEST=cypress` -> enables `cypress` + `webhook-test-server`
- `TEST=playwright` -> enables `playwright` + `webhook-test-server`

### 6.3 Health Check

`server.start.sh` waits for the `webhook-test-server` container to be healthy before running tests (both Cypress and Playwright).

### 6.4 Environment Variables

| Variable | Container | Value |
|----------|-----------|-------|
| `CYPRESS_webhookBaseUrl` | cypress | `http://localhost:3000` |
| `PW_WEBHOOK_BASE_URL` | playwright | `http://localhost:3000` |

## 7. Test Integration

### 7.1 Cypress

Tests call `cy.requireWebhookServer()` which:
1. Health checks `GET /` on the webhook server
2. Calls `POST /setup` with Mattermost base URL, webhook base URL, and admin credentials
3. Validates HTTP 201 response

Tests then create slash commands pointing to webhook server endpoints and interact with them via the browser.

### 7.2 Playwright

Tests use `testConfig.webhookBaseUrl` from `@mattermost/playwright-lib` and:
1. Health check the webhook server via `fetch(webhookBaseUrl)`
2. Call `POST /setup` with connection details
3. Create slash commands via `adminClient.addCommand()`
4. Interact with dialogs via the Playwright browser

### 7.3 Smoke Tests

Both test suites include a webhook smoke test tagged `@smoke`:
- **Cypress**: `webhook_server/webhook_server_health_spec.js` — Triggers a simple dialog, submits, verifies response
- **Playwright**: `interactive_dialog/simple_dialog.spec.ts` (MM-T2500_4) — Same flow via Playwright

## 8. Expansion

### Adding a new dialog (config only)

1. Add template to `config/dialogs.json`
2. Add service entry to `config/services.json` with `"type": "open-dialog"` and `"dialog": "<name>"`
3. Restart server

### Adding a new service type (code required)

1. Write handler function in `handlers/*.js`
2. Add type-to-handler mapping in `server.js` `TYPE_HANDLERS`
3. Add service entry to `config/services.json`
4. Format and lint: `npm run check`
