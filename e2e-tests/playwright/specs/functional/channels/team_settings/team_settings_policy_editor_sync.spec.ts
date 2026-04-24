// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for policy create/edit/delete in Team Settings Modal
 * @reference MM-67594
 */

import {expect, test} from '@mattermost/playwright-lib';

import {
    assignChannelsToPolicy,
    createParentPolicy,
    createPrivateChannel,
    createTeamAdmin,
    loginAndOpenPoliciesTab,
    setupTeamWithABAC,
} from './support';

test.describe('Team Settings Modal - Policy Editor', () => {
    test('MM-67967_1 Team admin can trigger sync and see updated status', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Sync Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // * Footer visible with "Sync now" action
        const footer = teamSettings.container.locator('.SyncStatusFooter');
        await expect(footer).toBeVisible({timeout: 10000});
        await expect(teamSettings.container.getByText(/Sync now/)).toBeVisible();

        // # Click Sync now
        await teamSettings.container.getByText(/Sync now/).click();

        // * Syncing state appears
        await expect(teamSettings.container.getByText(/Syncing/)).toBeVisible({timeout: 5000});

        // * Wait for sync to complete and "Sync now" to reappear
        await expect(teamSettings.container.getByText(/Sync now/)).toBeVisible({timeout: 30000});

        // * Status updates to "Last synced just now" confirming a fresh sync completed
        await expect(teamSettings.container.getByText(/Last synced just now/)).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67967_2 System admin can trigger sync from team settings', async ({pw}) => {
        const {adminUser, adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `SysAdmin Sync ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, adminUser, team.name);

        // * Footer visible with "Sync now" action
        await expect(teamSettings.container.getByText(/Sync now/)).toBeVisible({timeout: 15000});

        // # Click Sync now
        await teamSettings.container.getByText(/Sync now/).click();

        // * Wait for sync to complete and "Sync now" to reappear
        await expect(teamSettings.container.getByText(/Sync now/)).toBeVisible({timeout: 30000});

        // * Status updates to "Last synced just now" confirming a fresh sync completed
        await expect(teamSettings.container.getByText(/Last synced just now/)).toBeVisible();

        await teamSettings.close();
    });
});
