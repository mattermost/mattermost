// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for the Membership Policies tab in Team Settings Modal
 * @reference MM-67669
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

import {
    enableABACConfig,
    ensureDepartmentAttribute,
    createParentPolicy,
    assignChannelsToPolicy,
    createPrivateChannel,
    createTeamAdmin,
} from './helpers';

test.describe('Team Settings Modal - Membership Policies Tab', () => {
    test('MM-67669_1 Membership Policies tab visible for admin with ABAC enabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, adminConfig} = await pw.initSetup();
        const config = {...adminConfig};
        config.AccessControlSettings = {...config.AccessControlSettings, EnableAttributeBasedAccessControl: true};
        await adminClient.updateConfig(config);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        // * Both tabs visible
        await expect(teamSettings.accessPoliciesTab).toBeVisible();
        await expect(teamSettings.accessTab).toContainText('Access');

        await teamSettings.close();
    });

    test('MM-67669_2 Membership Policies tab hidden when ABAC disabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser} = await pw.initSetup();

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        // * Tab is not visible
        await expect(teamSettings.accessPoliciesTab).not.toBeVisible();

        await teamSettings.close();
    });

    test('MM-67669_4 Empty state displayed when no policies exist', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, adminConfig} = await pw.initSetup();
        const config = {...adminConfig};
        config.AccessControlSettings = {...config.AccessControlSettings, EnableAttributeBasedAccessControl: true};
        await adminClient.updateConfig(config);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Empty state shown
        await expect(teamSettings.container.getByText('No policies found')).toBeVisible();

        // * Sync footer hidden when no policies exist
        await expect(teamSettings.container.locator('.SyncStatusFooter')).not.toBeVisible();

        await teamSettings.close();
    });

    test('MM-67669_5 Policy list shows team-scoped policy with channel count', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create policy with one channel assigned
        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Team Policy ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Policy name and channel count shown
        await expect(teamSettings.container.getByText(policy.name)).toBeVisible();
        await expect(teamSettings.container.getByText('1 channel')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67669_6 Cross-team policy not shown in team settings', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

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

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Cross-team policy not visible
        await expect(teamSettings.container.getByText(crossPolicy.name)).not.toBeVisible();

        await teamSettings.close();
    });

    test('MM-67669_7 Team Admin sees Membership Policies tab and team-scoped policies', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Policy ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        // * Tab visible for Team Admin
        await expect(teamSettings.accessPoliciesTab).toBeVisible();

        await teamSettings.openAccessPoliciesTab();

        // * Policy and channel count shown
        await expect(teamSettings.container.getByText(policy.name)).toBeVisible();
        await expect(teamSettings.container.getByText('1 channel')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67669_8 Team Admin does not see cross-team policies', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

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

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Single-team policy visible, cross-team policy not visible
        await expect(teamSettings.container.getByText(teamPolicy.name)).toBeVisible();
        await expect(teamSettings.container.getByText(crossPolicy.name)).not.toBeVisible();

        await teamSettings.close();
    });
});
