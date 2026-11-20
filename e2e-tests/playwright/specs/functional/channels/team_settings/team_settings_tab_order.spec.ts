// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - four-tab layout and Channel Membership label
 * @reference MM-69100
 */

import {expect, Msg, test, type App, type PlaywrightExtended} from '@mattermost/playwright-lib';

import {enableTeamMembershipABACConfig} from './helpers';

/** Logs in as the admin with team membership ABAC on, and opens Team Settings from the team menu. */
async function openTeamSettings(pw: PlaywrightExtended) {
    await pw.skipIfNoLicense();
    const {adminUser, adminClient, team, townSquare} = await pw.initSetup();
    await enableTeamMembershipABACConfig(adminClient);
    const {app} = await pw.testBrowser.login(adminUser);
    await app.channelsPage.goto({team, channel: townSquare});
    return openSettings(app);
}

async function openSettings(app: App) {
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu.teamSettingsMenuItem);
    const settings = await app.lhs.teamMenu.teamSettingsMenuItem.clickTo(app.teamSettingsModal);
    return settings;
}

test.describe('Team Settings Modal - Tab Order', {tag: ['@abac', '@team_membership']}, () => {
    test('MM-69100_20 Four-tab order: Info, Access, Team Membership, Channel Membership', async ({pw}) => {
        const settings = await openTeamSettings(pw);
        const {tabs} = settings;

        // * Exactly four tabs, in order
        await expect.poll(() => tabs.tabList.keys()).toEqual(['info', 'access', 'team_membership', 'access_policies']);

        // * Each tab carries its label; the fourth is Channel Membership, not the old Membership Policies
        await expect(tabs.tab('info')).toHaveMessage(Msg.team_settings_modal.infoTab);
        await expect(tabs.tab('access')).toHaveMessage(Msg.team_settings_modal.accessTab);
        await expect(tabs.tab('team_membership')).toHaveMessage(Msg.team_settings_modal.teamMembershipTab);
        await expect(tabs.tab('access_policies')).toHaveMessage(Msg.team_settings_modal.accessPoliciesTab);
        await expect(tabs.tab('access_policies')).not.toContainText('Membership Policies');

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-69100_21 Channel Membership tab label is "Channel Membership", not "Membership Policies"', async ({
        pw,
    }) => {
        const settings = await openTeamSettings(pw);
        const channelMembershipTab = settings.tabs.tab('access_policies');

        // * Tab button is visible and labelled Channel Membership
        await expect(channelMembershipTab).toBeVisible();
        await expect(channelMembershipTab).toHaveMessage(Msg.team_settings_modal.accessPoliciesTab);

        // * Old label is gone
        await expect(channelMembershipTab).not.toContainText('Membership Policies');

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-69100_22 Channel Membership tab (4th) opens the policy editor content', async ({pw}) => {
        const settings = await openTeamSettings(pw);

        // # Click Channel Membership tab
        await settings.tabs.tab('access_policies').select();

        // * Channel Membership tab content is functional (shows the policy list's empty state)
        await expect(settings.accessPolicies.policies.rows).toContainMessage(
            Msg.admin.user_settings.policy_list.no_policies_found,
        );

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-69100_23 Team Membership and Channel Membership tabs are independently navigable', async ({pw}) => {
        const settings = await openTeamSettings(pw);
        const teamRules = settings.membership.rules;
        const policies = settings.accessPolicies.policies.rows;

        // # Navigate to Team Membership tab
        await settings.tabs.tab('team_membership').select();
        await expect(teamRules).toBeVisible();

        // # Navigate to Channel Membership tab
        await settings.tabs.tab('access_policies').select();
        await expect(policies).toContainMessage(Msg.admin.user_settings.policy_list.no_policies_found);
        await expect(teamRules).not.toBeVisible();

        // # Navigate back to Team Membership tab
        await settings.tabs.tab('team_membership').select();
        await expect(teamRules).toBeVisible();
        await expect(policies).not.toBeVisible();

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });
});
