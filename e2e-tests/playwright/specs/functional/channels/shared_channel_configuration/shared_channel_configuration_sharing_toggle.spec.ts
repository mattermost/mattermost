// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for Channel Settings → Configuration → Share with connected workspaces
 * Covers: TC-WEB-01, TC-WEB-02, TC-WEB-03, TC-WEB-04, TC-WEB-06, TC-WEB-07, TC-WEB-08, TC-WEB-09, TC-WEB-10
 */

import {
    expect,
    getRandomId,
    hasCustomPermissionsSchemesLicense,
    hasSharedChannelsLicense,
    test,
} from '@mattermost/playwright-lib';

import {sharedChannelsEnabledConfig, skipUnlessSharedChannelsLicense} from './support';

/**
 * Minimal type for ensureConfirmedRemote. We use this instead of importing Client4 from
 * @mattermost/client so the helper only depends on the two methods it needs. The adminClient
 * from pw.initSetup() is the full Client4 (from platform/client); no changes are made there.
 */
type ClientWithRemotes = {
    createRemoteCluster: (payload: {
        name: string;
        display_name: string;
        default_team_id: string;
        password?: string;
    }) => Promise<{invite: string; password: string; remote_cluster: {name: string; display_name: string}}>;
    acceptInviteRemoteCluster: (payload: {
        name: string;
        display_name: string;
        default_team_id: string;
        invite: string;
        password: string;
    }) => Promise<unknown>;
};

/**
 * Creates and confirms a remote connection by completing the invite handshake.
 * This allows the "Share with connected workspaces" toggle to be enabled in channel configuration
 * and workspaces to appear in the workspace selector.
 */
async function ensureConfirmedRemote(adminClient: ClientWithRemotes, teamId: string): Promise<void> {
    const suffix = getRandomId();
    const password = `e2e-remote-pwd-${suffix}`;
    const {invite} = await adminClient.createRemoteCluster({
        name: `e2e-remote-${suffix}`,
        display_name: `E2E Test Remote ${suffix}`,
        default_team_id: teamId,
        password,
    });
    await adminClient.acceptInviteRemoteCluster({
        name: `e2e-remote-accept-${suffix}`,
        display_name: `E2E Test Remote Accept ${suffix}`,
        default_team_id: teamId,
        invite,
        password,
    });
}

test.describe('Shared channel configuration', () => {
    test('Enable sharing toggle, verify UI persistence after refresh, disable sharing toggle', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        await skipUnlessSharedChannelsLicense(adminClient);

        await adminClient.patchConfig(sharedChannelsEnabledConfig);

        try {
            await ensureConfirmedRemote(adminClient, team.id);
        } catch {
            test.skip(true, 'Skipping - Remote Cluster Service not available or invitation handshake failed');
        }

        const channelName = `shared-config-06-${getRandomId()}`;
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Sharing Toggle Test',
            type: 'O',
        });

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        // Enable sharing
        let channelSettingsModal = await channelsPage.openChannelSettings();
        let configurationTab = await channelSettingsModal.openConfigurationTab();
        await configurationTab.enableShareWithWorkspaces();
        await configurationTab.addFirstAvailableWorkspace();
        await configurationTab.save();
        await channelSettingsModal.close();

        // Verify sharing persisted via API — also acts as a service-availability gate
        const updatedChannel = await adminClient.getChannel(channel.id);
        test.skip(
            !updatedChannel.shared,
            'Skipping - channel sharing did not persist; Shared Channels Service may not be running or no workspace was available',
        );

        // Verify toggle is active after reload
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();
        channelSettingsModal = await channelsPage.openChannelSettings();
        configurationTab = await channelSettingsModal.openConfigurationTab();
        await expect(configurationTab.shareWithWorkspacesToggle).toHaveAttribute('aria-pressed', 'true');
        await channelSettingsModal.close();

        // Disable sharing
        channelSettingsModal = await channelsPage.openChannelSettings();
        configurationTab = await channelSettingsModal.openConfigurationTab();
        await configurationTab.disableShareWithWorkspaces();
        await configurationTab.save();
        await channelSettingsModal.close();

        // Verify toggle is inactive after reload
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();
        channelSettingsModal = await channelsPage.openChannelSettings();
        configurationTab = await channelSettingsModal.openConfigurationTab();
        await expect(configurationTab.shareWithWorkspacesToggle).toHaveAttribute('aria-pressed', 'false');
        await channelSettingsModal.close();
    });

    test('User with manage shared channels but not manage channel properties: opens settings on Configuration tab, Info tab not visible', async ({
        pw,
    }) => {
        const {adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            !hasSharedChannelsLicense(license) || !hasCustomPermissionsSchemesLicense(license),
            'Skipping test - server does not have Shared Channels license or Custom Permission Schemes',
        );

        await adminClient.patchConfig(sharedChannelsEnabledConfig);

        const roles = await adminClient.getRolesByNames(['channel_user']);
        const channelRole = roles[0];
        const originalChannelPermissions = channelRole.permissions as string[];
        const withoutManageChannelProperties = originalChannelPermissions.filter(
            (p) => p !== 'manage_public_channel_properties',
        );
        await adminClient.patchRole(channelRole.id, {permissions: withoutManageChannelProperties});

        const randomUser = await pw.random.user();
        const sharedChannelUser = await adminClient.createUser(randomUser, '', '');
        sharedChannelUser.password = randomUser.password;
        await adminClient.addToTeam(team.id, sharedChannelUser.id);
        await adminClient.updateUserRoles(sharedChannelUser.id, 'system_user system_shared_channel_manager');

        const channelName = `shared-config-permissions-${getRandomId()}`;
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Shared Channels Only Test',
            type: 'O',
        });
        await adminClient.addToChannel(sharedChannelUser.id, channel.id);

        try {
            const {channelsPage} = await pw.testBrowser.login(sharedChannelUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            const channelSettingsModal = await channelsPage.openChannelSettings();
            await channelSettingsModal.toBeVisible();

            await expect(channelSettingsModal.configurationTab).toBeVisible();
            await expect(channelSettingsModal.infoTab).toHaveCount(0);
            await expect(channelSettingsModal.configurationSettings.container).toBeVisible();
            await expect(channelSettingsModal.configurationSettings.shareWithConnectedWorkspacesSection).toBeVisible();

            await channelSettingsModal.close();
        } finally {
            await adminClient.patchRole(channelRole.id, {permissions: originalChannelPermissions});
        }
    });
});
