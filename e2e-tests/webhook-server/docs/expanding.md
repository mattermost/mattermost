# Expanding the Webhook Server

This document explains how to add new endpoints, modify inputs/outputs, and extend the server for new test requirements.

## Decision Tree

Before making changes, determine what you need:

```
What do you need?
│
├── A new dialog with different fields?
│   └── Config only (no code) ──── See "Add a New Dialog"
│
├── A new URL that opens an existing dialog type?
│   └── Config only (no code) ──── See "Add a New Route for an Existing Type"
│
├── A new endpoint with custom behavior?
│   └── Code required ──────────── See "Add a New Service Type"
│
├── Change what an existing endpoint returns?
│   └── Depends:
│       ├── Dialog fields/title/etc → Edit config/dialogs.json
│       └── Response logic → Edit the handler in handlers/
│
└── Change what an existing endpoint accepts?
    └── Edit the handler in handlers/
```

## Add a New Dialog

**When:** You need a dialog with a specific combination of form elements (text, select, boolean, date, etc.) for a test.

**Steps:**

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
                    { "text": "Feature Request", "value": "feature" },
                    { "text": "General Feedback", "value": "general" }
                ]
            },
            {
                "type": "textarea",
                "display_name": "Description",
                "name": "description",
                "placeholder": "Describe your feedback...",
                "optional": false,
                "min_length": 10,
                "max_length": 500
            },
            {
                "type": "bool",
                "display_name": "Follow up?",
                "name": "follow_up",
                "placeholder": "Would you like us to follow up?",
                "optional": true
            }
        ]
    }
}
```

**Available element types:**

| Type | Fields | Description |
|------|--------|-------------|
| `text` | `subtype` (email, number, password, tel, url), `min_length`, `max_length`, `default`, `placeholder`, `help_text` | Single-line text input |
| `textarea` | `min_length`, `max_length`, `default`, `placeholder`, `help_text` | Multi-line text input |
| `select` | `options`, `data_source` (users, channels, dynamic), `multiselect`, `default`, `placeholder`, `help_text` | Dropdown selector |
| `radio` | `options`, `default`, `help_text` | Radio button group |
| `bool` | `default`, `placeholder`, `help_text` | Checkbox |
| `date` | `default`, `min_date`, `placeholder`, `help_text` | Date picker |
| `datetime` | `default`, `time_interval`, `datetime_config`, `placeholder`, `help_text` | Date and time picker |

**Special config fields** (underscore-prefixed, resolved at runtime):

| Field | Where | Purpose |
|-------|-------|---------|
| `_submit_url_path` | Dialog root | Override submit URL (default: `/dialog-submit`) |
| `_source_url_path` | Dialog root | Set `source_url` for field refresh dialogs |
| `_data_source_url_path` | Element | Set `data_source_url` for dynamic selects |
| `_is_form_response` | Dialog root | Mark as form response (used for multistep navigation) |
| `include_defaults_variant` | Dialog root | Map of element names to default values when `?includeDefaults=true` |

### 2. Add a service entry in `config/services.json`

```json
{
    "path": "/feedback-dialog-request",
    "method": "POST",
    "type": "open-dialog",
    "dialog": "feedbackForm",
    "description": "Opens a feedback form with category selector, description textarea, and follow-up checkbox."
}
```

### 3. Restart the server

The new endpoint is live. No code was written.

### 4. Use it in a test

**Cypress:**
```js
cy.apiCreateCommand({
    trigger: 'feedback',
    url: `${webhookBaseUrl}/feedback-dialog-request`,
    method: 'P',
    team_id: team.id,
});

cy.postMessage('/feedback ');
cy.get('#appsModal').should('be.visible');
cy.get('#appsModalLabel').should('have.text', 'Submit Feedback');
```

**Playwright:**
```ts
await adminClient.addCommand({
    trigger: 'feedback',
    url: `${webhookBaseUrl}/feedback-dialog-request`,
    method: 'P',
    team_id: team.id,
} as Command);

await postCreate.postMessage('/feedback ');
await expect(page.locator('#appsModal')).toBeVisible();
```

---

## Add a New Route for an Existing Type

**When:** You need a different URL path that uses the same behavior as an existing endpoint.

Just add a service entry to `config/services.json`. No dialog or handler changes needed.

**Example:** You want `/quick-feedback` to open the same dialog as `/feedback-dialog-request`:

```json
{
    "path": "/quick-feedback",
    "method": "POST",
    "type": "open-dialog",
    "dialog": "feedbackForm",
    "description": "Alias for feedback dialog — same form, shorter path."
}
```

---

## Add a New Service Type

**When:** None of the existing types fit your requirement. You need custom request handling logic.

### 1. Write a handler function

Create a new file in `handlers/` or add to an existing one. The handler receives:

```js
function myHandler({ req, res, body, query, context, meta }) {
    // req     — Node.js http.IncomingMessage
    // res     — Node.js http.ServerResponse
    // body    — Parsed JSON body (POST only)
    // query   — Parsed query parameters as object
    // context — Shared state (baseUrl, webhookBaseUrl, credentials)
    // meta    — Service metadata from services.json (type, dialog, description)
}
```

**Example:** A handler that echoes back the request body with a timestamp:

```js
// handlers/echo.js
const { sendJSON } = require("../lib/router");

function echo({ body, query, res }) {
    sendJSON(res, 200, {
        received_at: new Date().toISOString(),
        body,
        query,
    });
}

module.exports = { echo };
```

### 2. Register the type in `server.js`

Add the import and mapping:

```js
const { echo } = require("./handlers/echo");

const TYPE_HANDLERS = {
    // ... existing types ...
    "echo": echo,
};
```

### 3. Add the service entry in `config/services.json`

```json
{
    "path": "/echo",
    "method": "POST",
    "type": "echo",
    "description": "Echoes back the request body and query params with a server timestamp. Useful for debugging webhook payloads."
}
```

### 4. Format and lint

```sh
npm run check
```

---

## Modify an Existing Endpoint's Output

### Change dialog fields, title, or options

Edit `config/dialogs.json`. No code changes.

**Example:** Add a "Priority" field to the feedback dialog:

```json
{
    "feedbackForm": {
        "elements": [
            // ... existing elements ...
            {
                "type": "select",
                "display_name": "Priority",
                "name": "priority",
                "placeholder": "Select priority...",
                "optional": true,
                "options": [
                    { "text": "Low", "value": "low" },
                    { "text": "Medium", "value": "medium" },
                    { "text": "High", "value": "high" }
                ]
            }
        ]
    }
}
```

### Change response logic

Edit the handler function in `handlers/`. The response helpers are:

```js
const { sendJSON, sendText, redirect } = require("../lib/router");

// JSON response
sendJSON(res, 200, { text: "Success" });

// Plain text response
sendText(res, 201, "Created");

// HTTP redirect
redirect(res, "https://example.com");
```

### Post a message to Mattermost

Use the admin credentials stored by `/setup`:

```js
const { postAsAdmin } = require("../lib/http_client");

// Post a message as sysadmin
postAsAdmin(context.baseUrl, {
    username: context.adminUsername,
    password: context.adminPassword,
    channelId: body.channel_id,
    message: "Hello from the webhook server",
});
```

### Open a dialog via Mattermost API

```js
const { openDialog } = require("../lib/http_client");

openDialog(context.baseUrl, {
    trigger_id: body.trigger_id,
    url: `${context.webhookBaseUrl}/dialog-submit`,
    dialog: {
        title: "My Dialog",
        callback_id: "my_callback",
        elements: [/* ... */],
    },
});
```

---

## Modify an Existing Endpoint's Input

Handlers receive the full request. To accept new input fields, update the handler logic.

**Example:** Make `/post-outgoing-webhook` support a new `?include_timestamp=true` query param:

```js
// In handlers/outgoing_webhook.js
function outgoingWebhookResponse({ body, query, res }) {
    const response = {
        text: getWebhookResponse(body, { /* ... */ }),
        // ...
    };

    // New: optionally include timestamp
    if (query.include_timestamp === "true") {
        response.timestamp = new Date().toISOString();
    }

    sendJSON(res, 200, response);
}
```

No config changes needed — query parameters and body fields are passed through automatically.

---

## Common Patterns

### Pattern: Dialog with custom submit URL

If your dialog needs a different submit endpoint (not `/dialog-submit`):

```json
{
    "myDialog": {
        "callback_id": "my_callback",
        "title": "Custom Submit",
        "_submit_url_path": "/my-custom-submit",
        "elements": [/* ... */]
    }
}
```

Then add a service for the submit endpoint:

```json
{
    "path": "/my-custom-submit",
    "method": "POST",
    "type": "my-custom-submit",
    "description": "Handles submissions from the custom dialog."
}
```

And register a handler for the `my-custom-submit` type.

### Pattern: Dialog with dynamic select

To make a select element load options dynamically:

```json
{
    "elements": [
        {
            "type": "select",
            "display_name": "Choose item",
            "name": "item",
            "data_source": "dynamic",
            "_data_source_url_path": "/my-dynamic-source",
            "placeholder": "Search..."
        }
    ]
}
```

Then add a service and handler for `/my-dynamic-source` that returns:

```json
{
    "items": [
        { "text": "Option A", "value": "a" },
        { "text": "Option B", "value": "b" }
    ]
}
```

### Pattern: Dialog with field refresh

To make fields change based on a selection:

```json
{
    "myDialog": {
        "_source_url_path": "/my-field-refresh-source",
        "elements": [
            {
                "type": "select",
                "display_name": "Type",
                "name": "type",
                "refresh": true,
                "options": [/* ... */]
            }
        ]
    }
}
```

The handler at `/my-field-refresh-source` receives the current form state in `body.submission` and returns:

```json
{
    "type": "form",
    "form": {
        "title": "Updated Form",
        "elements": [/* new elements based on selection */]
    }
}
```

### Pattern: Multistep dialog

Define each step as a separate dialog in `dialogs.json`. The first step is opened via `open-dialog`. Subsequent steps are returned from the `dialog-submit` handler by checking `body.callback_id` and `body.state`.

See the existing `multistepStep1`, `multistepStep2`, `multistepStep3` dialogs in `config/dialogs.json` for a complete example.

---

## Checklist Before Submitting

- [ ] New dialog templates added to `config/dialogs.json`
- [ ] New services added to `config/services.json` with clear descriptions
- [ ] New handlers (if any) registered in `server.js` `TYPE_HANDLERS`
- [ ] Server starts without errors: `node server.js`
- [ ] `GET /` shows your new endpoints
- [ ] Formatting passes: `npm run fmt:check`
- [ ] Linting passes: `npm run lint`
- [ ] Test uses the endpoint and verifies the expected behavior
