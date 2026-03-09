// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {testConfig} from './test_config';

let isSetupDone = false;
let isAvailable: boolean | null = null;

/**
 * Checks if the webhook server is running and initializes it with Mattermost
 * connection details. Idempotent — only runs the setup once per process.
 *
 * Throws if the webhook server is not reachable.
 *
 * Usage:
 * ```ts
 * await pw.requireWebhookServer();
 * // or
 * import {requireWebhookServer} from '@mattermost/playwright-lib';
 * await requireWebhookServer();
 * ```
 */
export async function requireWebhookServer(): Promise<string> {
    const webhookBaseUrl = testConfig.webhookBaseUrl;

    if (isSetupDone) {
        return webhookBaseUrl;
    }

    if (isAvailable === false) {
        throw new Error(`Webhook server at ${webhookBaseUrl} is not reachable.`);
    }

    try {
        const healthRes = await fetch(webhookBaseUrl, {signal: AbortSignal.timeout(5000)});
        if (!healthRes.ok) {
            isAvailable = false;
            throw new Error(`Webhook server at ${webhookBaseUrl} returned ${healthRes.status}.`);
        }
    } catch (err) {
        isAvailable = false;
        if (err instanceof Error && err.message.startsWith('Webhook server')) {
            throw err;
        }
        throw new Error(
            `Webhook server at ${webhookBaseUrl} is not reachable.\n` +
                'Start it with: node e2e-tests/webhook-server/dist/server.js',
        );
    }

    const setupRes = await fetch(`${webhookBaseUrl}/setup`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            baseUrl: testConfig.baseURL,
            webhookBaseUrl,
            adminUsername: testConfig.adminUsername,
            adminPassword: testConfig.adminPassword,
        }),
    });

    if (setupRes.status !== 201) {
        isAvailable = false;
        throw new Error(`Webhook server setup failed with status ${setupRes.status}.`);
    }

    isAvailable = true;
    isSetupDone = true;
    return webhookBaseUrl;
}

interface DialogDefinition {
    callback_id: string;
    title: string;
    icon_url?: string;
    submit_label?: string;
    introduction_text?: string;
    state?: string;
    elements?: Array<Record<string, any>>;
}

interface RegisterDialogOptions {
    /** Dialog name — registered at POST /dialog/<name> */
    name: string;

    /** The dialog definition — what the user sees */
    dialog: DialogDefinition;
}

/**
 * Registers a dialog on the webhook server at `POST /dialog/<name>`.
 * The test defines the dialog inline and this function makes it available.
 *
 * Re-registering the same name overwrites the previous config automatically.
 *
 * Returns the full URL for use in slash command creation.
 *
 * Usage:
 * ```ts
 * const dialogUrl = await pw.registerWebhookDialog({
 *     name: 'my-test-dialog',
 *     dialog: {
 *         callback_id: 'my_test',
 *         title: 'My Test Dialog',
 *         submit_label: 'Send',
 *         elements: [{type: 'text', display_name: 'Name', name: 'name'}],
 *     },
 * });
 *
 * await adminClient.addCommand({url: dialogUrl, trigger: 'mycommand', ...});
 * ```
 */
export async function registerDialog(options: RegisterDialogOptions): Promise<string> {
    const webhookBaseUrl = testConfig.webhookBaseUrl;
    const {name, dialog} = options;
    const path = `/dialog/${name}`;

    await registerRoute({
        path,
        type: 'dialog',
        action: 'open',
        dialog,
        description: `Opens: ${dialog.title}`,
    });

    return `${webhookBaseUrl}${path}`;
}

interface RegisterOutgoingResponseOptions {
    /** Response name — registered at POST /outgoing/<name> */
    name: string;

    /** The JSON response the webhook server returns when Mattermost calls it */
    response: Record<string, any>;
}

/**
 * Registers an outgoing webhook response on the webhook server at `POST /outgoing/<name>`.
 * The test defines exactly what the server returns — no hidden behavior.
 *
 * Returns the full callback URL for use in outgoing webhook creation.
 *
 * Usage:
 * ```ts
 * const marker = 'Response from MM-T617';
 * const callbackUrl = await pw.registerOutgoingResponse({
 *     name: 'test-delete',
 *     response: {text: marker},
 * });
 *
 * await adminClient.createOutgoingWebhook({
 *     callback_urls: [callbackUrl],
 *     trigger_words: ['testing'],
 *     ...
 * });
 *
 * // Assert on `marker` — the test owns the expected text
 * await expect(lastPost.container).toContainText(marker);
 * ```
 */
export async function registerOutgoingResponse(options: RegisterOutgoingResponseOptions): Promise<string> {
    const webhookBaseUrl = testConfig.webhookBaseUrl;
    const {name, response} = options;
    const path = `/outgoing/${name}`;

    await registerRoute({
        path,
        type: 'json-response',
        response,
        description: `Outgoing webhook response: ${name}`,
    });

    return `${webhookBaseUrl}${path}`;
}

interface RegisterRouteBody {
    path: string;
    method?: string;
    type: string;
    action?: string;
    dialog?: Record<string, any>;
    response?: Record<string, any>;
    responseText?: string;
    statusCode?: number;
    description?: string;
}

/**
 * Low-level: register any dynamic route on the webhook server.
 * Re-registering the same path overwrites the previous config.
 */
export async function registerRoute(body: RegisterRouteBody): Promise<void> {
    const webhookBaseUrl = testConfig.webhookBaseUrl;
    const res = await fetch(`${webhookBaseUrl}/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    });

    if (res.status !== 201) {
        const text = await res.text();
        throw new Error(`Failed to register route ${body.path}: ${res.status} ${text}`);
    }
}
