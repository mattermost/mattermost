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
        webhookBaseUrl?: string;
    },
): Promise<void> {
    const webhookBaseUrl = opts.webhookBaseUrl ?? testConfig.webhookBaseUrl;
    const res = await request.post(`${webhookBaseUrl}/setup`, {
        headers: {'Content-Type': 'application/json'},
        data: {
            baseUrl: opts.mattermostBaseUrl,
            webhookBaseUrl,
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
