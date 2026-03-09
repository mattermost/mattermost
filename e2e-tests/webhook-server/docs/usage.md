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
node e2e-tests/webhook-server/server.js
```

**CI:** The server starts automatically as the `webhook-test-server` Docker service.

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

### 3. Create an integration pointing to a webhook endpoint

Create a slash command (or outgoing webhook, or incoming webhook) that points to one of the server's endpoints.

**Cypress:**
```js
const webhookBaseUrl = Cypress.env().webhookBaseUrl;

cy.apiCreateCommand({
    method: 'P',
    team_id: team.id,
    trigger: 'my_command',
    url: `${webhookBaseUrl}/simple-dialog-request`,
    // ...
});
```

**Playwright:**
```ts
const command = await adminClient.addCommand({
    method: 'P',
    team_id: team.id,
    trigger: 'my_command',
    url: `${webhookBaseUrl}/simple-dialog-request`,
    // ...
} as Command);
```

### 4. Trigger the integration and verify

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

Run the server and visit `GET http://localhost:3000/` to see the live service catalog. Each endpoint includes its HTTP method, path, type, and description.

The full list is also in `config/services.json`.

### Quick Reference

| Endpoint | What It Does |
|----------|-------------|
| `GET /` | Health check, returns service catalog |
| `POST /setup` | Initialize with Mattermost connection details |
| `POST /dialog-request` | Opens full dialog (all element types) |
| `POST /simple-dialog-request` | Opens dialog with no elements |
| `POST /boolean-dialog-request` | Opens dialog with boolean checkbox |
| `POST /multiselect-dialog-request` | Opens dialog with multiselect elements |
| `POST /dynamic-select-dialog-request` | Opens dialog with dynamic select |
| `POST /dialog/field-refresh` | Opens field refresh dialog |
| `POST /dialog/multistep` | Opens 3-step wizard dialog |
| `POST /dialog-submit` | Handles all dialog submissions |
| `POST /datetime-dialog-request` | Opens datetime dialog (multiple variants) |
| `POST /datetime-dialog-submit` | Handles datetime dialog submissions |
| `POST /dynamic-select-source` | Returns filtered options for dynamic select |
| `POST /field-refresh-source` | Returns updated form on field change |
| `POST /message-menus` | Responds to message menu actions |
| `POST /slack-compatible-message-response` | Returns Slack-compatible ephemeral response |
| `POST /send-message-to-channel` | Sends message to a channel |
| `POST /post-outgoing-webhook` | Responds to outgoing webhook |
| `POST /send-oauth-credentials` | Stores OAuth app credentials |
| `GET /start-oauth` | Redirects to OAuth authorization |
| `GET /complete-oauth` | OAuth callback, exchanges code for token |
| `POST /post-oauth-message` | Posts message using OAuth token |

### Backward Compatibility

Legacy Cypress tests use underscore URLs (e.g., `/dialog_request`). The server automatically normalizes underscores to hyphens, so both forms work:
- `/dialog_request` -> routes to `/dialog-request`
- `/slack_compatible_message_response` -> routes to `/slack-compatible-message-response`
