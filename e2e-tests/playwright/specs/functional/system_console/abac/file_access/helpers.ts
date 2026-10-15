// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect, getRandomId, newTestPassword} from '@mattermost/playwright-lib';

import {createPrivateChannelForABAC, ensureUserAttributes, getPolicyIdByName} from '../support';

export async function setupUserAndChannel(
    adminClient: any,
    team: any,
): Promise<{
    testUser: any;
    channelName: string;
    channelId: string;
}> {
    // Ensure at least one user attribute field exists so the permission policy
    // CEL editor's "Switch to Advanced Mode" button is enabled in the UI.
    await ensureUserAttributes(adminClient, ['Department']);

    const username = `user${getRandomId()}`;
    const password = newTestPassword();
    const testUser = await adminClient.createUser(
        {email: `${username}@example.com`, username, password} as any,
        '',
        '',
    );
    (testUser as any).password = password;

    await adminClient.addToTeam(team.id, testUser.id);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(testUser.id, channel.id);

    return {testUser, channelName: channel.name, channelId: channel.id};
}

/**
 * Every initSetup() rewrites the shared server config, so an earlier spec can leave ABAC off.
 * Without this the policy is created but never enforced, and the allow-side tests pass blindly.
 */
export async function ensureABACEnabled(adminClient: Client4): Promise<void> {
    await adminClient.patchConfig({
        AccessControlSettings: {EnableAttributeBasedAccessControl: true},
    } as any);

    await expect
        .poll(
            async () => {
                const cfg = await adminClient.getConfig();
                return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
            },
            {timeout: 15000, intervals: [500, 1000, 2000]},
        )
        .toBe(true);
}

/** Block until a just-created policy is readable through the search API. */
export async function waitForPolicy(adminClient: Client4, policyName: string): Promise<void> {
    await expect
        .poll(async () => Boolean(await getPolicyIdByName(adminClient, policyName, 1)), {
            timeout: 30000,
            intervals: [500, 1000, 2000],
        })
        .toBe(true);
}
