// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAdminClient} from './init';
import {clearAdminLockout} from './lockout';
import {PlaywrightClient4} from './playwright_client';

import {testConfig} from '@/test_config';

/** Admin login attempt: returns the error, or null on success. */
async function probeAdminLogin(): Promise<Error | null> {
    const client = new PlaywrightClient4();
    client.setUrl(testConfig.baseURL);
    try {
        await client.login(testConfig.adminUsername, testConfig.adminPassword);
        return null;
    } catch (error) {
        return error as Error;
    }
}

/** Clears a known login lockout; returns true if one was cleared. */
export async function clearAdminLoginLockout(): Promise<boolean> {
    return clearAdminLockout(await probeAdminLogin());
}

/** getAdminClient() that clears known lockouts; any other login failure throws. */
export async function getAdminClientHealing() {
    let admin = await getAdminClient({skipLog: true});
    if (!admin.adminUser && (await clearAdminLoginLockout())) {
        admin = await getAdminClient({skipLog: true});
    }

    if (!admin.adminUser) {
        const cause = await probeAdminLogin();
        throw new Error(`Could not log in as the admin user: ${cause?.message ?? 'login succeeded on retry only'}`, {
            cause,
        });
    }

    return {adminClient: admin.adminClient, adminUser: admin.adminUser};
}
