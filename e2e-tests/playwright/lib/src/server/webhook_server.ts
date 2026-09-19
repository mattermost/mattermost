// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {APIRequestContext} from '@playwright/test';

import {testConfig} from '@/test_config';

/**
 * Health check for the webhook sidecar used by Cypress and Playwright integration tests
 * (`e2e-tests/cypress`: `npm run start:webhook`, default http://localhost:3000).
 */
export async function isWebhookTestServerReachable(
    request: APIRequestContext,
    webhookBaseUrl: string = testConfig.webhookBaseUrl,
): Promise<boolean> {
    try {
        const res = await request.get(webhookBaseUrl, {timeout: 5000});
        return res.ok();
    } catch {
        return false;
    }
}

/**
 * POST /setup on the webhook sidecar so it can call back into Mattermost (dialogs, OAuth, etc.).
 * Required before routes that use `baseUrl` / admin credentials.
 */
export async function setupWebhookTestServer(
    request: APIRequestContext,
    opts: {
        mattermostBaseUrl: string;
        adminUsername: string;
        adminPassword: string;
        /**
         * Address the webhook sidecar should stamp onto any dialog/form URLs it builds itself
         * (e.g. chained multi-step dialogs) for the Mattermost *server* to call back into it.
         * Defaults to `testConfig.webhookBaseUrl`. Distinct from the fixed request target below,
         * which the *test process* uses to physically reach the sidecar and is never overridden —
         * in testcontainers mode that's the host-mapped port, while a server-dereferenced URL
         * needs the container-internal alias (`testConfig.webhookInternalUrl`).
         */
        webhookBaseUrl?: string;
    },
): Promise<void> {
    const payloadWebhookBaseUrl = opts.webhookBaseUrl ?? testConfig.webhookBaseUrl;
    const res = await request.post(`${testConfig.webhookBaseUrl}/setup`, {
        headers: {'Content-Type': 'application/json'},
        data: {
            baseUrl: opts.mattermostBaseUrl,
            webhookBaseUrl: payloadWebhookBaseUrl,
            adminUsername: opts.adminUsername,
            adminPassword: opts.adminPassword,
        },
        timeout: 15000,
    });
    if (!res.ok()) {
        const body = await res.text();
        throw new Error(`Webhook test server /setup failed: HTTP ${res.status()} ${body}`);
    }
}
