// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {testConfig} from '@mattermost/playwright-lib';

const baseUrl = testConfig.baseURL;

interface PostToWebhookOptions {
    /** If set, asserts the response status matches this code (e.g., 400, 403). Skips the default success check. */
    failWithCode?: number;
}

/**
 * Posts data to an incoming webhook URL.
 * Asserts the response is successful (2xx) by default.
 * Pass `{failWithCode: 400}` to assert a specific failure status instead.
 */
export async function postToWebhook(
    hookId: string,
    data: Record<string, any>,
    options: PostToWebhookOptions = {},
): Promise<Response> {
    const res = await fetch(`${baseUrl}/hooks/${hookId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
    });

    if (options.failWithCode !== undefined) {
        expect(res.status).toBe(options.failWithCode);
    } else {
        expect(res.ok, `Webhook post failed with status ${res.status}`).toBeTruthy();
    }

    return res;
}
