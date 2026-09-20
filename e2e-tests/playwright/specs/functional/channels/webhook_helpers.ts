// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {APIRequestContext} from '@playwright/test';

import {duration, testConfig} from '@mattermost/playwright-lib';

export async function postToWebhook(request: APIRequestContext, webhookId: string, payload: Record<string, unknown>) {
    const response = await request.post(`${testConfig.baseURL}/hooks/${webhookId}`, {
        headers: {'Content-Type': 'application/json'},
        data: payload,
        timeout: duration.half_min,
    });

    if (!response.ok()) {
        throw new Error(`Webhook POST failed: ${response.status()} ${await response.text()}`);
    }
}
