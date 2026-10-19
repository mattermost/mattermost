// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - four-tab layout and Channel Membership label
 * @reference MM-69100
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

import {enableTeamMembershipABACConfig} from './helpers';

test.describe('Team Settings Modal - Tab Order', {tag: ['@abac', '@team_membership']}, () => {
    test('MM-69100_20 Four-tab order: Info, Access, Team Membership, Channel Membership', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        // # Collect all visible tab buttons in order
        const tabButtons = teamSettings.container.locator('[data-testid$="-tab-button"]');

        // * Exactly 4 tabs are visible
        await expect(tabButtons).toHaveCount(4);

        // * Tabs appear in the correct order
        await expect(tabButtons.nth(0)).toContainText('Info');
        await expect(tabButtons.nth(1)).toContainText('Access');
        await expect(tabButtons.nth(2)).toContainText('Team Membership');
        await expect(tabButtons.nth(3)).toContainText('Channel Membership');

        // * Fourth tab does NOT contain the old label
        await expect(tabButtons.nth(3)).not.toContainText('Membership Policies');

        await teamSettings.close();
    });

    test('MM-69100_21 Channel Membership tab label is "Channel Membership", not "Membership Policies"', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        const channelMembershipTab = teamSettings.container.getByTestId('access_policies-tab-button');

        // * Tab button is visible
        await expect(channelMembershipTab).toBeVisible();

        // * Label is "Channel Membership"
        await expect(channelMembershipTab).toContainText('Channel Membership');

        // * Old label is gone
        await expect(channelMembershipTab).not.toContainText('Membership Policies');

        await teamSettings.close();
    });

    test('MM-69100_22 Channel Membership tab (4th) opens the policy editor content', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        // # Click Channel Membership tab
        await teamSettings.container.getByTestId('access_policies-tab-button').click();

        // * Channel Membership tab content is functional (shows empty state or policy list)
        await expect(teamSettings.container.getByText('No policies found')).toBeVisible({timeout: 10000});

        await teamSettings.close();
    });

    test('MM-69100_23 Team Membership and Channel Membership tabs are independently navigable', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        // # Navigate to Team Membership tab
        await teamSettings.container.getByTestId('team_membership-tab-button').click();
        await expect(teamSettings.container.locator('.TeamMembershipTab')).toBeVisible();

        // # Navigate to Channel Membership tab
        await teamSettings.container.getByTestId('access_policies-tab-button').click();
        await expect(teamSettings.container.getByText('No policies found')).toBeVisible({timeout: 10000});
        await expect(teamSettings.container.locator('.TeamMembershipTab')).not.toBeVisible();

        // # Navigate back to Team Membership tab
        await teamSettings.container.getByTestId('team_membership-tab-button').click();
        await expect(teamSettings.container.locator('.TeamMembershipTab')).toBeVisible();

        await teamSettings.close();
    });
});
