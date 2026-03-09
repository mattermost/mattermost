# Usage Guide

This document explains how the webhook test server is used during E2E tests.

## How the Server Fits into Test Automation

The webhook test server sits between Mattermost and the test framework. When a test creates a slash command or integration that points to a webhook server URL, Mattermost calls that URL when triggered by a user action in the browser. The server responds with the appropriate data (open a dialog, return a message, etc.).

```
┌─────────────┐     1. Create slash command      ┌──────────────┐
│  Test Code   │ ─────── pointing to ──────────── │  Mattermost  │
│ (Cypress or  │     webhook server URL           │   Server     │
│  Playwright) │                                  │              │
└──────┬───────┘                                  └──────┬───────┘
       │                                                 │
       │  2. User types /command                         │
       │     in the browser                              │
       │                                                 │
       │                           3. Mattermost calls   │
       │                              webhook server     │
       │                                                 ▼
       │                                          ┌──────────────┐
       │                                          │   Webhook    │
       │                                          │ Test Server  │
       │                                          │ (port 3000)  │
       │                                          └──────┬───────┘
       │                                                 │
       │                           4. Server responds    │
       │                              (open dialog,      │
       │                               return message)   │
       │                                                 │
       │  5. Test verifies the                           │
       │     result in the browser                       │
       └─────────────────────────────────────────────────┘
```

## Step-by-Step: Writing a Test That Uses the Webhook Server

### 1. Ensure the server is running

**Local development:**
```sh
cd e2e-tests/webhook-server
npm install
npm run dev
```

**CI:** The server starts automatically as a Docker service.

### 2. Initialize the server with Mattermost connection details

Before any test that uses webhook endpoints, call `POST /setup`:

**Cypress:**
```js
cy.requireWebhookServer();
```

**Playwright:**
```ts
import {testConfig} from '@mattermost/playwright-lib';

const webhookBaseUrl = testConfig.webhookBaseUrl;

await fetch(`${webhookBaseUrl}/setup`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        baseUrl: testConfig.baseURL,
        webhookBaseUrl,
        adminUsername: testConfig.adminUsername,
        adminPassword: testConfig.adminPassword,
    }),
});
```

### 3. Register dynamic routes (if needed)

For tests that need custom endpoints, register them via `POST /register`:

```ts
// Register a dialog endpoint
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

// Register a dialog submit handler
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

Or use one of the static dialog endpoints already registered from `config/dialogs.json` (e.g., `POST /dialog/full`, `POST /dialog/simple`).

### 4. Create an integration pointing to a webhook endpoint

Create a slash command (or outgoing webhook, or incoming webhook) that points to one of the server's endpoints.

**Cypress:**
```js
const webhookBaseUrl = Cypress.env().webhookBaseUrl;

cy.apiCreateCommand({
    method: 'P',
    team_id: team.id,
    trigger: 'my_command',
    url: `${webhookBaseUrl}/my-dialog`,
    // ...
});
```

**Playwright:**
```ts
const command = await adminClient.addCommand({
    method: 'P',
    team_id: team.id,
    trigger: 'my_command',
    url: `${webhookBaseUrl}/my-dialog`,
    // ...
} as Command);
```

### 5. Trigger the integration and verify

**Cypress:**
```js
cy.postMessage('/my_command ');
cy.get('#appsModal').should('be.visible');
```

**Playwright:**
```ts
await channelsPage.centerView.postCreate.postMessage('/my_command ');
const modal = channelsPage.page.locator('#appsModal');
await expect(modal).toBeVisible();
```

## Available Endpoints

Run the server and visit `GET http://localhost:3000/` to see all registered routes (both static dialogs and dynamically registered routes).

### Static Endpoints (always available)

| Endpoint | What It Does |
|----------|-------------|
| `GET /` | Health check, returns all registered routes |
| `POST /setup` | Initialize with Mattermost connection details |
| `POST /register` | Register a dynamic route at runtime |
| `POST /success` | Simple 200 OK response |
| `POST /message-menus` | Responds to message menu actions |
| `POST /slack-compatible-response` | Returns Slack-compatible ephemeral response |
| `POST /message-in-channel` | Sends message with extra_responses to a channel |
| `POST /outgoing` | Responds to outgoing webhook with formatted echo |

### Static Dialog Endpoints (from config/dialogs.json)

| Endpoint | What It Does |
|----------|-------------|
| `POST /dialog/full` | Opens full dialog (all element types) |
| `POST /dialog/simple` | Opens dialog with no elements |
| `POST /dialog/userAndChannel` | Opens dialog with user + channel selectors |
| `POST /dialog/boolean` | Opens dialog with boolean checkbox |
| `POST /dialog/multiselect` | Opens dialog with multiselect elements |
| `POST /dialog/dynamicSelect` | Opens dialog with dynamic select |
| `POST /dialog/fieldRefresh` | Opens field refresh dialog |
| `POST /dialog/multistepStep1` | Opens 3-step wizard dialog (step 1) |
| `POST /dialog/basicDate` | Opens date picker dialog |
| `POST /dialog/basicDateTime` | Opens date + time picker dialog |

### Backward Compatibility

Legacy Cypress tests use underscore URLs (e.g., `/dialog_submit`). The server automatically normalizes underscores to hyphens, so both forms work:
- `/message_menus` -> routes to `/message-menus`
- `/slack_compatible_response` -> routes to `/slack-compatible-response`

## Dynamic Route Types

| Type | Action | What It Does |
|------|--------|-------------|
| `dialog` | `open` | Opens an interactive dialog via Mattermost API |
| `dialog` | `submit` | Handles dialog submission, posts confirmation message to channel |
| `json-response` | — | Returns a configured JSON response |
| `text-response` | — | Returns a configured plain text response |
