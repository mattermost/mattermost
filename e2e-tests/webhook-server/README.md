# Webhook Test Server

Config-driven webhook test server for Mattermost E2E tests. Shared by both Cypress and Playwright test suites.

## Quick Start

```sh
node server.js
```

No `npm install` required. The server uses only Node.js built-in APIs (`node:http`, `fetch`, `URL`) with zero dependencies.

**Requirements:** Node.js >= 24.0.0 (per root `.nvmrc`)

## How It Works

The server exposes webhook endpoints that Mattermost calls during test automation (slash commands, interactive dialogs, outgoing webhooks, OAuth flows, etc.).

1. **Test starts** the server (Docker in CI, or `node server.js` locally)
2. **Test calls `POST /setup`** with Mattermost connection details (base URL, credentials)
3. **Test creates a slash command** pointing to a webhook server endpoint
4. **User triggers the slash command** in the browser, Mattermost calls the webhook server
5. **Webhook server responds** (opens a dialog, returns a message, etc.)

## Service Catalog

Run the server and visit `GET /` to see all available endpoints with descriptions.

Every endpoint is defined in `config/services.json`. Each entry has:
- `path` and `method` — The HTTP endpoint
- `type` — The service behavior (e.g., `open-dialog`, `dialog-submit`, `message-menu`)
- `description` — What the endpoint does, what input it expects, and what output it produces

### Service Types

| Type | Behavior | When to Use |
|------|----------|-------------|
| `ping` | Returns server status and full service catalog | Health checks |
| `setup` | Stores Mattermost connection details in server state | Server initialization |
| `open-dialog` | Opens an interactive dialog defined in `config/dialogs.json` | Any dialog test |
| `dialog-submit` | Handles dialog form submission; advances multistep dialogs | Dialog submission endpoint |
| `datetime-dialog-request` | Opens a datetime dialog variant based on subcommand | DateTime field tests |
| `datetime-dialog-submit` | Handles datetime form submission, posts confirmation | DateTime submission endpoint |
| `dynamic-select-source` | Returns filtered options for dynamic select elements | Dynamic select data source |
| `field-refresh-source` | Returns updated form based on field selection | Field refresh data source |
| `message-menu` | Responds to interactive message menu actions | Message menu tests |
| `slack-compatible-response` | Returns Slack-compatible ephemeral response | Slack parsing tests |
| `send-to-channel` | Sends message with extra_responses to a channel | Channel message tests |
| `outgoing-webhook-response` | Responds to outgoing webhook with formatted echo | Outgoing webhook tests |
| `oauth-credentials` | Stores OAuth2 app credentials | OAuth flow setup |
| `oauth-start` | Redirects to OAuth2 authorization | OAuth flow initiation |
| `oauth-complete` | Exchanges auth code for access token | OAuth callback |
| `oauth-message` | Posts message using stored OAuth token | OAuth message posting |

## Adding a New Endpoint

### New dialog type (config only, no code)

1. Add a dialog template to `config/dialogs.json`:
   ```json
   {
       "myDialog": {
           "callback_id": "my_callback",
           "title": "My Dialog",
           "elements": [
               { "type": "text", "display_name": "Name", "name": "name", "optional": false }
           ]
       }
   }
   ```
2. Add a service entry to `config/services.json`:
   ```json
   {
       "path": "/my-dialog-request",
       "method": "POST",
       "type": "open-dialog",
       "dialog": "myDialog",
       "description": "Opens my custom dialog with a name field."
   }
   ```
3. Restart the server. Done.

### New service type (code required)

This is for behaviors that don't fit existing types.

1. Write a handler function in an existing or new `handlers/*.js` file
2. Register the type in `TYPE_HANDLERS` in `server.js`
3. Add the service entry to `config/services.json` with a clear description

## URL Convention

All URL paths use **hyphens** (`-`), e.g., `/dialog-request`, `/send-message-to-channel`.

For backward compatibility with existing Cypress tests that use underscores (e.g., `/dialog_request`), the router automatically normalizes underscores to hyphens.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_PORT` | `3000` | Port the server listens on |

## Docker (CI)

In CI, the server runs as the `webhook-test-server` Docker service defined in `.ci/server.generate.sh`:

```yaml
webhook-test-server:
    image: node:<version>-slim
    command: node server.js
    working_dir: /webhook
    network_mode: host
    volumes:
        - "../../e2e-tests/webhook-server:/webhook:ro"
```

No `npm install`, no network dependency — just `node server.js`.

## Local Development

### Cypress

```sh
# Terminal 1: start webhook server
node e2e-tests/webhook-server/server.js

# Terminal 2: run Cypress tests
cd e2e-tests/cypress
npm run cypress:open
```

### Playwright

```sh
# Terminal 1: start webhook server
node e2e-tests/webhook-server/server.js

# Terminal 2: run Playwright tests
cd e2e-tests/playwright
npx playwright test specs/functional/channels/interactive_dialog/
```

Or set the environment variable if the server is on a different host/port:
```sh
PW_WEBHOOK_BASE_URL=http://localhost:3000
```

## Contributing

### Setup

No package installation is needed to run or modify the server. Just use Node.js:

```sh
node server.js
```

### Formatting and Linting

Formatting and linting use `npx` to run [oxfmt](https://oxc.rs/docs/guide/usage/formatter) and [oxlint](https://oxc.rs/docs/guide/usage/linter) on demand. No packages to install.

```sh
# Format all files
npx oxfmt --write .

# Check formatting (CI-friendly, no file changes)
npx oxfmt --check .

# Lint all files
npx oxlint .

# Lint and auto-fix
npx oxlint --fix .

# Run both checks
npm run check
```

Or via npm scripts:
```sh
npm run fmt          # format
npm run fmt:check    # check format
npm run lint         # lint
npm run lint:fix     # lint + fix
npm run check        # format check + lint
```

### File Naming

All file names use **snake_case** (e.g., `message_menu.js`, `http_client.js`).

### Directory Structure

```
webhook-server/
├── server.js              # Entry point, loads services, maps types to handlers
├── config/
│   ├── services.json      # Service catalog (endpoints, types, descriptions)
│   └── dialogs.json       # Dialog template definitions
├── handlers/              # Internal handlers (consumers don't need to read these)
│   ├── ping.js
│   ├── setup.js
│   ├── dialog.js
│   ├── message_menu.js
│   ├── outgoing_webhook.js
│   ├── oauth.js
│   └── message.js
├── lib/                   # Server infrastructure
│   ├── context.js         # Shared state container
│   ├── http_client.js     # Native fetch wrapper for Mattermost API
│   └── router.js          # Lightweight path-based router
├── package.json           # Metadata and scripts only, no dependencies
└── README.md
```
