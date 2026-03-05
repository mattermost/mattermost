// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for the Access Policies tab in Team Settings Modal
 * @reference MM-67669 - Add Access Policies tab to Team Settings modal
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

test.describe('Team Settings Modal - Access Policies Tab', () => {
    test('MM-67669_1 Access Policies tab visible for admin with ABAC enabled', async ({pw}) => {
        // # Set up admin user
        const {adminUser, adminClient, adminConfig} = await pw.initSetup();

        // # Enable ABAC
        const config = {...adminConfig};
        config.AccessControlSettings = {
            ...config.AccessControlSettings,
            EnableAttributeBasedAccessControl: true,
        };
        await adminClient.updateConfig(config);

        // # Login and navigate to channels
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto();
        await page.waitForLoadState('networkidle');

        // # Open Team Settings
        const teamSettings = await channelsPage.openTeamSettings();

        // * Verify Access Policies tab is visible
        await expect(teamSettings.accessPoliciesTab).toBeVisible();

        // * Verify the old Access tab is now labeled "Membership"
        await expect(teamSettings.accessTab).toContainText('Membership');

        // # Close modal
        await teamSettings.close();
    });

    test('MM-67669_2 Access Policies tab hidden when ABAC disabled', async ({pw}) => {
        // # Set up admin user (ABAC disabled by default)
        const {adminUser} = await pw.initSetup();

        // # Login and navigate
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto();
        await page.waitForLoadState('networkidle');

        // # Open Team Settings
        const teamSettings = await channelsPage.openTeamSettings();

        // * Verify Access Policies tab is NOT visible
        await expect(teamSettings.accessPoliciesTab).not.toBeVisible();

        // # Close modal
        await teamSettings.close();
    });

    test('MM-67669_4 Empty state displayed when no policies exist', async ({pw}) => {
        // # Set up admin user
        const {adminUser, adminClient, adminConfig} = await pw.initSetup();

        // # Enable ABAC
        const config = {...adminConfig};
        config.AccessControlSettings = {
            ...config.AccessControlSettings,
            EnableAttributeBasedAccessControl: true,
        };
        await adminClient.updateConfig(config);

        // # Login and navigate
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto();
        await page.waitForLoadState('networkidle');

        // # Open Team Settings and click Access Policies tab
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Verify empty state is shown (PolicyList default empty state)
        await expect(teamSettings.container.getByText('No policies found')).toBeVisible();

        // # Close modal
        await teamSettings.close();
    });

    test('MM-67669_5 Policy list shows team-scoped policy with channel count', async ({pw}) => {
        // # Set up admin user
        const {adminUser, adminClient, adminConfig, team} = await pw.initSetup();

        // # Enable ABAC
        const config = {...adminConfig};
        config.AccessControlSettings = {
            ...config.AccessControlSettings,
            EnableAttributeBasedAccessControl: true,
        };
        await adminClient.updateConfig(config);

        // # Create a private channel in this team
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `private-abac-${Date.now()}`,
            display_name: 'ABAC Private Channel',
            type: 'P',
        } as any);

        // # Create a parent access control policy
        const policy = await adminClient.updateOrCreateAccessControlPolicy({
            id: '',
            name: `Test Policy ${Date.now()}`,
            type: 'parent',
            version: 'v0.2',
            revision: 0,
            rules: [{expression: 'true', actions: ['*']}],
        } as any);

        // # Assign the channel to the policy
        await adminClient.assignChannelsToAccessControlPolicy(policy.id, [channel.id]);

        // # Login and navigate to the team
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings and click Access Policies tab
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Verify policy name is shown
        await expect(teamSettings.container.getByText(policy.name)).toBeVisible();

        // * Verify channel count is shown
        await expect(teamSettings.container.getByText('1 channel')).toBeVisible();

        // # Close modal
        await teamSettings.close();
    });

    test('MM-67669_6 Cross-team policy not shown in team settings', async ({pw}) => {
        // # Set up admin user
        const {adminUser, adminClient, adminConfig, team} = await pw.initSetup();

        // # Enable ABAC
        const config = {...adminConfig};
        config.AccessControlSettings = {
            ...config.AccessControlSettings,
            EnableAttributeBasedAccessControl: true,
        };
        await adminClient.updateConfig(config);

        // # Create a second team
        const otherTeam = await adminClient.createTeam({
            name: `other-team-${Date.now()}`,
            display_name: 'Other Team',
            type: 'O',
        } as any);

        // # Create private channels in both teams
        const channel1 = await adminClient.createChannel({
            team_id: team.id,
            name: `private-team1-${Date.now()}`,
            display_name: 'Team 1 Channel',
            type: 'P',
        } as any);

        const channel2 = await adminClient.createChannel({
            team_id: otherTeam.id,
            name: `private-team2-${Date.now()}`,
            display_name: 'Team 2 Channel',
            type: 'P',
        } as any);

        // # Create a policy and assign channels from BOTH teams (cross-team scope)
        const crossTeamPolicy = await adminClient.updateOrCreateAccessControlPolicy({
            id: '',
            name: `Cross-Team Policy ${Date.now()}`,
            type: 'parent',
            version: 'v0.2',
            revision: 0,
            rules: [{expression: 'true', actions: ['*']}],
        } as any);

        await adminClient.assignChannelsToAccessControlPolicy(crossTeamPolicy.id, [channel1.id, channel2.id]);

        // # Login and navigate to the first team
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await page.waitForLoadState('networkidle');

        // # Open Team Settings and click Access Policies tab
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // * Verify cross-team policy does NOT appear (scope spans two teams)
        await expect(teamSettings.container.getByText(crossTeamPolicy.name)).not.toBeVisible();

        // # Close modal
        await teamSettings.close();
    });
});
