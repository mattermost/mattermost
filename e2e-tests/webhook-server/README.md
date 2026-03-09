# Webhook Test Server

Config-driven webhook test server for Mattermost E2E tests. Shared by both Cypress and Playwright test suites.

## Quick Start

```sh
# Development (TypeScript, no build step)
npm run dev

# Production (build + run)
npm run start
```

**Requirements:** Node.js >= 24.0.0, npm install required (Express 5.2.1 dependency)

## How It Works

The server exposes webhook endpoints that Mattermost calls during test automation (slash commands, interactive dialogs, outgoing webhooks, etc.).

1. **Test starts** the server (Docker in CI, or `npm run dev` locally)
2. **Test calls `POST /setup`** with Mattermost connection details (base URL, credentials)
3. **Test registers dynamic routes** via `POST /register` (or uses static dialogs from `config/dialogs.json`)
4. **Test creates a slash command** pointing to a webhook server endpoint
5. **User triggers the slash command** in the browser, Mattermost calls the webhook server
6. **Webhook server responds** (opens a dialog, returns a message, etc.)

## Endpoints

### Static Endpoints (hardcoded in server.ts)

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check. Returns `"I'm alive!"` and list of all registered routes |
| `POST /setup` | Store Mattermost connection details (baseUrl, webhookBaseUrl, adminUsername, adminPassword) |
| `POST /register` | Register a dynamic route at runtime (see [Dynamic Routes](#dynamic-routes)) |
| `POST /success` | Simple 200 OK response (`{ status: "ok" }`) |
| `POST /message-menus` | Responds to interactive message menu actions |
| `POST /slack-compatible-response` | Returns Slack-compatible ephemeral response |
| `POST /message-in-channel` | Sends message with `extra_responses` to a channel |
| `POST /outgoing` | Responds to outgoing webhook with formatted echo |

### Static Dialogs (from config/dialogs.json)

At startup, dialogs defined in `config/dialogs.json` are registered as routes at `POST /dialog/<name>`. These are read-only — tests cannot overwrite them via `/register`.

| Endpoint | Dialog |
|----------|--------|
| `POST /dialog/full` | Full dialog with all element types |
| `POST /dialog/simple` | Dialog with no elements — just title and submit |
| `POST /dialog/userAndChannel` | User selector + channel selector |
| `POST /dialog/boolean` | Single boolean checkbox |
| `POST /dialog/multiselect` | Multiselect option + user selectors |
| `POST /dialog/dynamicSelect` | Dynamic select loading from external source |
| `POST /dialog/fieldRefresh` | Field refresh — fields change based on selection |
| `POST /dialog/multistepStep1` | 3-step wizard, step 1 |
| `POST /dialog/multistepStep2` | 3-step wizard, step 2 |
| `POST /dialog/multistepStep3` | 3-step wizard, step 3 |
| `POST /dialog/basicDate` | Date picker |
| `POST /dialog/basicDateTime` | Date + time picker |
| `POST /dialog/minDateConstraint` | Date picker with min_date constraint |
| `POST /dialog/customInterval` | DateTime with custom time interval |
| `POST /dialog/relativeDate` | Date with relative default |
| `POST /dialog/timezoneManual` | Timezone + manual entry |

## Dynamic Routes

Tests register endpoints at runtime via `POST /register`. This is the primary mechanism for tests to define custom webhook behavior.

### Registration Payload

```json
{
    "path": "/my-test-endpoint",
    "type": "dialog | json-response | text-response",
    "method": "GET | POST",
    "action": "open | submit",
    "dialog": { "callback_id": "...", "title": "...", "elements": [...] },
    "response": { "any": "json object" },
    "responseText": "plain text response",
    "statusCode": 200,
    "description": "What this endpoint does"
}
```

### Route Types

| Type | Behavior | Required Fields |
|------|----------|-----------------|
| `dialog` (action: `open`) | Opens an interactive dialog via Mattermost API | `dialog` |
| `dialog` (action: `submit`) | Handles dialog form submission, posts confirmation to channel | — |
| `json-response` | Returns a JSON response | `response` |
| `text-response` | Returns a plain text response | `responseText` |

### Example: Register a dialog endpoint

```ts
await fetch(`${webhookBaseUrl}/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        path: '/my-dialog',
        type: 'dialog',
        action: 'open',
        dialog: {
            callback_id: 'my_callback',
            title: 'My Test Dialog',
            elements: [{type: 'text', display_name: 'Name', name: 'name'}],
        },
    }),
});
```

### Example: Register a submit handler

```ts
await fetch(`${webhookBaseUrl}/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        path: '/dialog-submit',
        type: 'dialog',
        action: 'submit',
    }),
});
```

## URL Convention

All URL paths use **hyphens** (`-`), e.g., `/dialog-submit`, `/message-in-channel`.

For backward compatibility with existing Cypress tests that use underscores (e.g., `/dialog_submit`), the server automatically normalizes underscores to hyphens.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_PORT` | `3000` | Port the server listens on |

## Docker (CI)

In CI, the server runs as a Docker service defined in `.ci/server.generate.sh`:

```yaml
webhook-test-server:
    image: node:<version>
    command: sh -c "npm install && node dist/server.js"
    working_dir: /webhook
    network_mode: host
    volumes:
        - "../../e2e-tests/webhook-server:/webhook"
```

## Local Development

### Development mode (TypeScript with tsx)

```sh
cd e2e-tests/webhook-server
npm install
npm run dev
```

### Run Cypress tests

```sh
# Terminal 1: start webhook server
cd e2e-tests/webhook-server && npm run dev

# Terminal 2: run Cypress tests
cd e2e-tests/cypress
npm run cypress:open
```

### Run Playwright tests

```sh
# Terminal 1: start webhook server
cd e2e-tests/webhook-server && npm run dev

# Terminal 2: run Playwright tests
cd e2e-tests/playwright
npx playwright test specs/functional/channels/integrations/
```

Or set the environment variable if the server is on a different host/port:
```sh
PW_WEBHOOK_BASE_URL=http://localhost:3000
```

## Technology Stack

- **Runtime:** Node.js >= 24.0.0
- **Language:** TypeScript 5.9
- **Framework:** Express 5.2.1
- **Build:** Vite (outputs `dist/server.js`)
- **HTTP Client:** Native `fetch` (Node.js built-in)
- **Formatting:** oxfmt
- **Linting:** oxlint

## Scripts

```sh
npm run dev          # Run in development mode (tsx, no build)
npm run build        # Build with Vite
npm run start        # Build + run
npm run fmt          # Format source files
npm run fmt:check    # Check formatting (CI-friendly)
npm run lint         # Lint source files
npm run lint:fix     # Lint + auto-fix
npm run check        # Type check + format check + lint
```

## Directory Structure

```
webhook-server/
├── src/
│   ├── server.ts              # Entry point: Express app, loads routes, starts listening
│   ├── handlers/
│   │   ├── ping.ts            # GET / — health check with service catalog
│   │   ├── setup.ts           # POST /setup — stores Mattermost connection details
│   │   ├── dynamic.ts         # POST /register + dynamic route middleware + dialog lifecycle
│   │   ├── message.ts         # Slack-compatible response + channel message handlers
│   │   ├── message_menu.ts    # Interactive message menu handler
│   │   └── outgoing.ts        # Outgoing webhook response handler
│   └── lib/
│       ├── context.ts         # Shared state container (ServerContext)
│       ├── http_client.ts     # Native fetch wrappers: openDialog, postAsAdmin
│       └── types.ts           # TypeScript interfaces: HandlerArgs, DialogConfig, etc.
├── config/
│   └── dialogs.json           # Static dialog templates (16 dialogs)
├── package.json               # Express dependency, build/lint scripts
├── tsconfig.json              # TypeScript config (ES2024 target, strict mode)
└── vite.config.ts             # Vite build config for Node 24 target
```
