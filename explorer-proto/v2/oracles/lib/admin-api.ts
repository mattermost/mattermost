// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {testConfig} from '@mattermost/playwright-lib';

export type AdminApi = {
    request(method: string, apiPath: string, body?: unknown): Promise<{status: number; body: unknown}>;
};

/** Seeding admin (library defaults) over the session origin; used only by measurement scripts that change data. */
export async function adminApi(origin: string): Promise<AdminApi> {
    const call = async (method: string, apiPath: string, body?: unknown, token = '') => {
        const headers: Record<string, string> = {'X-Requested-With': 'XMLHttpRequest'};
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(`${origin}/api/v4${apiPath}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
        });
        return {response, parsed: await response.json().catch(() => null)};
    };

    const login = await call('POST', '/users/login', {
        login_id: testConfig.adminUsername,
        password: testConfig.adminPassword,
    });
    const token = login.response.headers.get('token') ?? '';
    if (login.response.status !== 200 || !token) {
        throw new Error('admin login failed');
    }
    return {
        async request(method, apiPath, body) {
            const result = await call(method, apiPath, body, token);
            return {status: result.response.status, body: result.parsed};
        },
    };
}
