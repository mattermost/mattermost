// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for the Membership Policies tab in Team Settings Modal
 * @reference MM-67669
 */

import {expect, test} from '@mattermost/playwright-lib';

import {
    assignChannelsToPolicy,
    createParentPolicy,
    createPrivateChannel,
    createTeamAdmin,
    loginAndOpenPoliciesTab,
    loginAndOpenTeamSettings,
    setupTeamWithABAC,
} from './support';

test.describe('Team Settings Modal - Membership Policies Tab', () => {
    test('MM-67669_7 Team Admin sees Membership Policies tab and team-scoped policies', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Policy ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenTeamSettings(pw, teamAdmin, team.name);

        // * Tab visible for Team Admin
        await expect(teamSettings.accessPoliciesTab).toBeVisible();

        await teamSettings.openAccessPoliciesTab();

        // * Policy and channel count shown
        await expect(teamSettings.container.getByText(policy.name)).toBeVisible();
        await expect(teamSettings.container.getByText('1 channel')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67669_8 Team Admin does not see cross-team policies', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const otherTeam = await adminClient.createTeam({
            name: `other-${Date.now()}`,
            display_name: 'Other Team',
            type: 'O',
        } as any);
        const channel1 = await createPrivateChannel(adminClient, team.id);
        const channel2 = await createPrivateChannel(adminClient, otherTeam.id);

        const teamPolicy = await createParentPolicy(adminClient, `TA Visible ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, teamPolicy.id, [channel1.id]);

        const crossPolicy = await createParentPolicy(adminClient, `TA Hidden ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, crossPolicy.id, [channel1.id, channel2.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // * Single-team policy visible, cross-team policy not visible
        await expect(teamSettings.container.getByText(teamPolicy.name)).toBeVisible();
        await expect(teamSettings.container.getByText(crossPolicy.name)).not.toBeVisible();

        await teamSettings.close();
    });
});
