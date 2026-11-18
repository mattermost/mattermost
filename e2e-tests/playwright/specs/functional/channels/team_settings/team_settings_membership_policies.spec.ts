// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for the Membership Policies tab in Team Settings Modal
 * @reference MM-67669
 */

import {
    expect,
    getRandomId,
    Msg,
    test,
    type App,
    type PlaywrightExtended,
    duration,
    DefaultChannel,
} from '@mattermost/playwright-lib';

import {
    enableABACConfig,
    ensureDepartmentAttribute,
    createParentPolicy,
    assignChannelsToPolicy,
    createPrivateChannel,
    createTeamAdmin,
} from './helpers';

async function setupMembershipPoliciesTest(pw: PlaywrightExtended) {
    const {adminClient, adminUser} = await pw.getAdminClient();
    if (!adminUser) {
        throw new Error('Failed to get the admin user');
    }
    const suffix = getRandomId();
    const team = await adminClient.createTeam({
        name: `mp-${suffix}`,
        display_name: `MP ${suffix}`,
        type: 'O',
    } as any);
    const user = await pw.createNewUserProfile(adminClient, {prefix: 'mp-user'});
    await adminClient.addToTeam(team.id, user.id);
    await adminClient.addToTeam(team.id, adminUser.id);
    return {adminClient, adminUser, team, user};
}

/** Opens Team Settings from the team menu. */
async function openTeamSettings(app: App) {
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu.teamSettingsMenuItem);
    const settings = await app.lhs.teamMenu.teamSettingsMenuItem.clickTo(app.teamSettingsModal);
    return settings;
}

/** Opens Team Settings on the Channel Membership (access policies) tab and waits for its policy list. */
async function openPoliciesTab(app: App) {
    const settings = await openTeamSettings(app);
    await settings.tabs.tab('access_policies').select();
    const {policies} = settings.accessPolicies;
    await expect(policies.rows).toBeVisible();
    return {settings, policies};
}

test.describe('Team Settings Modal - Membership Policies Tab', () => {
    // Serial: several tests toggle ABAC; parallel runs in this file race the same server config.
    test.describe.configure({mode: 'serial'});

    test('MM-67669_1 Membership Policies tab visible for admin with ABAC enabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await setupMembershipPoliciesTest(pw);
        await enableABACConfig(adminClient);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

        const settings = await openTeamSettings(app);

        // * Both tabs visible
        await expect(settings.tabs.tab('access_policies')).toBeVisible();
        await expect(settings.tabs.tab('access')).toHaveMessage(Msg.team_settings_modal.accessTab);

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-67669_2 Membership Policies tab hidden when ABAC disabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await setupMembershipPoliciesTest(pw);

        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: false},
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === false;
        });

        const {app} = await pw.testBrowser.login(adminUser);
        const composer = app.center.postCreate.message.container.locator;
        await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});
        await expect(composer).toBeVisible();

        // Force a full navigation so the team settings bundle reads the latest
        // AccessControlSettings (WebSocket config updates can lag in CI).
        // Re-apply guard immediately before reload: a concurrent initSetup() may have
        // re-enabled ABAC between the waitUntil check above and here.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: false},
        });
        await app.page.reload();
        await expect(composer).toBeVisible();

        // Re-apply once more after the page has settled to prevent a WebSocket
        // CONFIG_CHANGED event (from a concurrent initSetup()) from flipping it back.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: false},
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === false;
        });

        const settings = await openTeamSettings(app);

        // * Tab is not visible (WebSocket config update can lag), while the tabs themselves are there
        await expect(settings.tabs.tab('info')).toBeVisible();
        await expect(settings.tabs.tab('access_policies')).not.toBeVisible({timeout: duration.half_min});

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-67669_4 Empty state displayed when no policies exist', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await setupMembershipPoliciesTest(pw);
        await enableABACConfig(adminClient);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

        const {settings, policies} = await openPoliciesTab(app);

        // * Empty state shown
        await expect(policies.rows).toContainMessage(Msg.admin.user_settings.policy_list.no_policies_found);

        // * Sync footer hidden when no policies exist (MM-67669_5 sees it once a policy exists)
        await expect(settings.accessPolicies.syncStatus).not.toBeVisible();

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-67669_5 Policy list shows team-scoped policy with channel count', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await setupMembershipPoliciesTest(pw);
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create policy with one channel assigned
        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Team Policy ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

        const {settings, policies} = await openPoliciesTab(app);

        // * Policy name and channel count shown, with the sync footer below the list
        const row = policies.row(policy.id);
        await expect(row.cell('name')).toContainText(policy.name);
        await expect(row.cell('resources')).toHaveMessage(Msg.admin.access_control.policies.resources.channels, {
            count: 1,
            channel: 'channel',
            channels: 'channels',
        });
        await expect(settings.accessPolicies.syncStatus).toBeVisible();

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-67669_6 Cross-team policy not shown in team settings', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await setupMembershipPoliciesTest(pw);
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

        const {app} = await pw.testBrowser.login(adminUser);
        await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

        const {settings, policies} = await openPoliciesTab(app);

        // * Cross-team policy not visible (the list has loaded: MM-67669_8 sees a team policy in the same list)
        await expect(policies.row(crossPolicy.id)).toHaveCount(0);

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-67669_7 Team Admin sees Membership Policies tab and team-scoped policies', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await setupMembershipPoliciesTest(pw);
        await enableABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `TA Policy ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {app} = await pw.testBrowser.login(teamAdmin);
        await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

        // * Tab visible for Team Admin
        const settings = await openTeamSettings(app);
        await expect(settings.tabs.tab('access_policies')).toBeVisible();
        await settings.tabs.tab('access_policies').select();

        // * Policy and channel count shown
        const row = settings.accessPolicies.policies.row(policy.id);
        await expect(row.cell('name')).toContainText(policy.name);
        await expect(row.cell('resources')).toHaveMessage(Msg.admin.access_control.policies.resources.channels, {
            count: 1,
            channel: 'channel',
            channels: 'channels',
        });

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });

    test('MM-67669_8 Team Admin does not see cross-team policies', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await setupMembershipPoliciesTest(pw);
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

        const {app} = await pw.testBrowser.login(teamAdmin);
        await app.channelsPage.goto({team, channel: DefaultChannel.TownSquare});

        const {settings, policies} = await openPoliciesTab(app);

        // * Single-team policy visible, cross-team policy not visible
        await expect(policies.row(teamPolicy.id).cell('name')).toContainText(teamPolicy.name);
        await expect(policies.row(crossPolicy.id)).toHaveCount(0);

        await settings.closeButton.click();
        await expect(settings.container).not.toBeVisible();
    });
});
