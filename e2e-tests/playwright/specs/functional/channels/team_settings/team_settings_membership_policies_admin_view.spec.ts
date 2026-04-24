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
    loginAndOpenPoliciesTab,
    setupTeamWithABAC,
} from './support';

test.describe('Team Settings Modal - Membership Policies Tab', () => {
    test('MM-67669_5 Policy list shows team-scoped policy with channel count', async ({pw}) => {
        const {adminUser, adminClient, team} = await setupTeamWithABAC(pw);

        // # Create policy with one channel assigned
        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Team Policy ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, adminUser, team.name);

        // * Policy name and channel count shown
        await expect(teamSettings.container.getByText(policy.name)).toBeVisible();
        await expect(teamSettings.container.getByText('1 channel')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67669_6 Cross-team policy not shown in team settings', async ({pw}) => {
        const {adminUser, adminClient, team} = await setupTeamWithABAC(pw);

        const otherTeam = await adminClient.createTeam({
            name: `other-${Date.now()}`,
            display_name: 'Other Team',
            type: 'O',
        } as any);
        const channel1 = await createPrivateChannel(adminClient, team.id);
        const channel2 = await createPrivateChannel(adminClient, otherTeam.id);

        // # Policy spans two teams
        const crossPolicy = await createParentPolicy(adminClient, `Cross Policy ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, crossPolicy.id, [channel1.id, channel2.id]);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, adminUser, team.name);

        // * Cross-team policy not visible
        await expect(teamSettings.container.getByText(crossPolicy.name)).not.toBeVisible();

        await teamSettings.close();
    });
});
