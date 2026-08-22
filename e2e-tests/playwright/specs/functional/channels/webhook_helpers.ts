// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, testConfig} from '@mattermost/playwright-lib';

export async function postToWebhook(webhookId: string, payload: Record<string, unknown>) {
    const response = await fetch(`${testConfig.baseURL}/hooks/${webhookId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(duration.half_min),
    });

    if (!response.ok) {
        throw new Error(`Webhook POST failed: ${response.status} ${await response.text()}`);
    }
}
