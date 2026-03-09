# Expanding the Webhook Server

This document explains how to add new endpoints, modify inputs/outputs, and extend the server for new test requirements.

## Decision Tree

```
What do you need?
│
├── A new dialog with different fields?
│   ├── For many tests (permanent) ──── See "Add a Static Dialog"
│   └── For one test (runtime) ──────── See "Register a Dynamic Dialog"
│
├── A new endpoint that returns a fixed response?
│   └── Register via POST /register ── See "Register a Dynamic Response"
│
├── A new endpoint with custom behavior?
│   └── Code required ──────────────── See "Add a New Static Handler"
│
├── Change what an existing static endpoint returns?
│   └── Edit the handler in src/handlers/
│
└── Change dialog fields/title/etc?
    ├── Static dialog → Edit config/dialogs.json
    └── Dynamic dialog → Change the /register payload in your test
```

## Add a Static Dialog

**When:** You need a reusable dialog available across many tests without runtime registration.

### 1. Define the dialog template in `config/dialogs.json`

Add a new key with your dialog definition:

```json
{
    "feedbackForm": {
        "callback_id": "feedback_callback",
        "title": "Submit Feedback",
        "icon_url": "https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png",
        "submit_label": "Send Feedback",
        "elements": [
            {
                "type": "select",
                "display_name": "Category",
                "name": "category",
                "placeholder": "Select category...",
                "optional": false,
                "options": [
                    { "text": "Bug Report", "value": "bug" },
                    { "text": "Feature Request", "value": "feature" }
                ]
            },
            {
                "type": "textarea",
                "display_name": "Description",
                "name": "description",
                "placeholder": "Describe your feedback...",
                "optional": false
            }
        ]
    }
}
```

### 2. Restart the server

The dialog is automatically registered as `POST /dialog/feedbackForm`. No code changes needed.

### 3. Use it in a test

```ts
// Point a slash command to the static dialog endpoint
await adminClient.addCommand({
    trigger: 'feedback',
    url: `${webhookBaseUrl}/dialog/feedbackForm`,
    method: 'P',
    team_id: team.id,
} as Command);

await postCreate.postMessage('/feedback ');
await expect(page.locator('#appsModal')).toBeVisible();
```

**Note:** Static dialog paths are protected — tests cannot overwrite them via `POST /register`. Use a unique path if you need a test-specific variant.

---

## Register a Dynamic Dialog

**When:** You need a dialog for a specific test, without modifying `config/dialogs.json`.

```ts
// Register the dialog endpoint
await fetch(`${webhookBaseUrl}/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        path: '/my-test-dialog',
        type: 'dialog',
        action: 'open',
        dialog: {
            callback_id: 'my_test_callback',
            title: 'Test-Specific Dialog',
            elements: [
                {type: 'text', display_name: 'Name', name: 'name'},
                {type: 'bool', display_name: 'Agree?', name: 'agree'},
            ],
        },
    }),
});

// Register a submit handler for the dialog
await fetch(`${webhookBaseUrl}/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        path: '/my-test-dialog-submit',
        type: 'dialog',
        action: 'submit',
    }),
});
```

The dialog's `_submit_url_path` field controls where submissions go. If not set, it defaults to `/dialog-submit`.

---

## Register a Dynamic Response

**When:** You need an endpoint that returns a fixed JSON or text response.

### JSON response

```ts
await fetch(`${webhookBaseUrl}/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        path: '/my-json-endpoint',
        type: 'json-response',
        response: {text: 'Hello from webhook!', response_type: 'in_channel'},
        statusCode: 200,
    }),
});
```

### Text response

```ts
await fetch(`${webhookBaseUrl}/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        path: '/my-text-endpoint',
        type: 'text-response',
        responseText: 'Plain text response',
        statusCode: 200,
    }),
});
```

---

## Add a New Static Handler

**When:** You need custom request handling logic that doesn't fit `dialog`, `json-response`, or `text-response` types.

### 1. Write a handler function

Create a new file in `src/handlers/` or add to an existing one. The handler receives `HandlerArgs`:

```ts
import type {HandlerArgs} from '../lib/types';

export function myHandler({body, query, context, res}: HandlerArgs): void {
    // body    — Parsed JSON body (POST only)
    // query   — Parsed query parameters as object
    // context — Shared state (baseUrl, webhookBaseUrl, credentials)
    // res     — Express Response object

    res.json({
        received_at: new Date().toISOString(),
        payload: body,
    });
}
```

### 2. Register the route in `src/server.ts`

Import your handler and add the route:

```ts
import {myHandler} from './handlers/my_handler';

// In the start() function, after existing static routes:
app.post('/my-endpoint', wrapHandler(myHandler));
```

### 3. Format and lint

```sh
npm run check
```

---

## Available Element Types for Dialogs

| Type | Key Fields | Description |
|------|-----------|-------------|
| `text` | `subtype` (email, number, password, tel, url), `min_length`, `max_length`, `default`, `placeholder`, `help_text` | Single-line text input |
| `textarea` | `min_length`, `max_length`, `default`, `placeholder`, `help_text` | Multi-line text input |
| `select` | `options`, `data_source` (users, channels, dynamic), `multiselect`, `default`, `placeholder`, `help_text` | Dropdown selector |
| `radio` | `options`, `default`, `help_text` | Radio button group |
| `bool` | `default`, `placeholder`, `help_text` | Checkbox |
| `date` | `default`, `min_date`, `placeholder`, `help_text` | Date picker |
| `datetime` | `default`, `time_interval`, `datetime_config`, `placeholder`, `help_text` | Date and time picker |

## Special Dialog Config Fields

These underscore-prefixed fields are resolved at runtime:

| Field | Where | Purpose |
|-------|-------|---------|
| `_submit_url_path` | Dialog root | Override submit URL (default: `/dialog-submit`) |
| `_source_url_path` | Dialog root | Set `source_url` for field refresh dialogs |
| `_data_source_url_path` | Element | Set `data_source_url` for dynamic selects |
| `include_defaults_variant` | Dialog root | Map of element names to default values |

---

## Posting Messages via Mattermost API

The server can post messages to channels using the admin credentials stored by `/setup`:

```ts
import {postAsAdmin} from '../lib/http_client';

// In a handler:
postAsAdmin(context.baseUrl, {
    username: context.adminUsername,
    password: context.adminPassword,
    channelId: body.channel_id,
    message: 'Hello from the webhook server',
});
```

## Opening Dialogs via Mattermost API

```ts
import {openDialog} from '../lib/http_client';

// In a handler:
openDialog(context.baseUrl, {
    trigger_id: body.trigger_id,
    url: `${context.webhookBaseUrl}/dialog-submit`,
    dialog: {
        title: 'My Dialog',
        callback_id: 'my_callback',
        elements: [/* ... */],
    },
});
```

---

## Checklist Before Submitting

- [ ] New static dialog templates added to `config/dialogs.json` (if permanent)
- [ ] New static handlers registered in `src/server.ts` (if custom logic)
- [ ] Server starts without errors: `npm run dev`
- [ ] `GET /` shows your new endpoints
- [ ] `npm run check` passes (type check + format + lint)
- [ ] Test uses the endpoint and verifies the expected behavior
