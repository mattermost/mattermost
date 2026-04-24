// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared helpers for ABAC file-access permission-policy specs.
 *
 * ABAC Permission Policies - File Access Runtime Enforcement (MM-64508)
 *
 * Tests that permission policies for download_file_attachment and
 * upload_file_attachment are correctly enforced in the channel UI.
 *
 * CEL strategy:
 *   - DENIED tests:  celExpression = 'false'  → unconditional deny, no attribute dependency
 *   - ALLOWED tests: no permission policy created → no-policy = implicit allow
 *
 * Cleanup strategy per describe block:
 *   - `let lastPolicyName` tracks the name of whatever policy the current test created
 *   - `afterEach` deletes it by exact name via deletePermissionPolicyByName (reliable)
 *   - `beforeEach` also deletes by name in case afterEach failed (safety net)
 *   - Individual tests just set lastPolicyName and do NOT do their own cleanup
 */

import type {Client4} from '@mattermost/client';

import {createPrivateChannelForABAC, deletePermissionPolicyByName, ensureUserAttributes} from '../support';

export interface SetupUserAndChannelResult {
    testUser: any;
    channelName: string;
    channelId: string;
}

/**
 * Creates a test user (with password), adds to team, creates a private channel
 * for ABAC, and adds the user to that channel. Ensures at least one user
 * attribute field exists so the permission policy CEL editor's
 * "Switch to Advanced Mode" button is enabled in the UI.
 */
export async function setupUserAndChannel(adminClient: any, team: any): Promise<SetupUserAndChannelResult> {
    // Ensure at least one user attribute field exists so the permission policy
    // CEL editor's "Switch to Advanced Mode" button is enabled in the UI.
    await ensureUserAttributes(adminClient, ['Department']);

    const randomId = Math.random().toString(36).substring(2, 9);
    const username = `user${randomId}`;
    const testUser = await adminClient.createUser(
        {email: `${username}@example.com`, username, password: 'Passwd4Testing!'} as any,
        '',
        '',
    );
    (testUser as any).password = 'Passwd4Testing!';

    await adminClient.addToTeam(team.id, testUser.id);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(testUser.id, channel.id);

    return {testUser, channelName: channel.name, channelId: channel.id};
}

/**
 * State shared across `test.afterEach` hooks in each describe block.
 * Tests assign `savedAdminClient` and `lastPolicyName` so the hook can
 * reliably delete the policy created during the test.
 */
export interface PermissionPolicyCleanupState {
    lastPolicyName: string;
    savedAdminClient: Client4 | null;
}

/**
 * Factory that returns an `afterEach` handler which deletes the last-created
 * permission policy (if any) via the REST API. Use inside a describe block:
 *
 *   const cleanup: PermissionPolicyCleanupState = {lastPolicyName: '', savedAdminClient: null};
 *   test.afterEach(cleanupPermissionPolicyAfterEach(cleanup));
 */
export function cleanupPermissionPolicyAfterEach(state: PermissionPolicyCleanupState) {
    return async () => {
        if (state.lastPolicyName && state.savedAdminClient) {
            await deletePermissionPolicyByName(state.savedAdminClient, state.lastPolicyName);
            state.lastPolicyName = '';
            state.savedAdminClient = null;
        }
    };
}
