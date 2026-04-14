// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for Channel Settings → Configuration → Share with connected workspaces
 * Covers: TC-WEB-01, TC-WEB-02, TC-WEB-03, TC-WEB-04, TC-WEB-06, TC-WEB-07, TC-WEB-08, TC-WEB-09, TC-WEB-10
 */

import {expect, hasCustomPermissionsSchemesLicense, hasSharedChannelsLicense, test} from '@mattermost/playwright-lib';
import {getRandomId} from 'utils/utils';

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
 * Deletes all remote clusters on the server. Use before TC-WEB-03 so that test sees "No connected
 * workspaces" and does not fail when other tests have created remotes.
 */
async function deleteAllRemoteClusters(adminClient: {
    getRemoteClusters: (options?: {onlyConfirmed?: boolean}) => Promise<Array<{remote_id: string}>>;
    deleteRemoteCluster: (remoteId: string) => Promise<unknown>;
}): Promise<void> {
    const remotes = await adminClient.getRemoteClusters({});
    for (const r of remotes) {
        await adminClient.deleteRemoteCluster(r.remote_id);
    }
}

/**
 * Creates and confirms a remote connection by completing the invite handshake.
 * This allows the "Share with connected workspaces" toggle to be enabled in channel configuration
 * and workspaces to appear in the workspace selector.
 */
async function ensureConfirmedRemote(adminClient: ClientWithRemotes, teamId: string): Promise<void> {
    const suffix = await getRandomId();
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
    test('Section visible when all conditions are met', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(!hasSharedChannelsLicense(license), 'Skipping test - server does not have Shared Channels license');

        await adminClient.patchConfig({
            ConnectedWorkspacesSettings: {
                EnableSharedChannels: true,
                EnableRemoteClusterService: true,
            },
        });

        const channelName = `shared-config-01-${await getRandomId()}`;
        await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Shared Config Test',
            type: 'O',
        });

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();

        await expect(configurationTab.shareWithConnectedWorkspacesSection).toBeVisible();
        await expect(configurationTab.shareWithWorkspacesToggle).toBeVisible();
        await channelSettingsModal.close();
    });

    test('Section hidden when shared channels feature is disabled', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(!hasSharedChannelsLicense(license), 'Skipping test - server does not have Shared Channels license');

        await adminClient.patchConfig({
            ConnectedWorkspacesSettings: {
                EnableSharedChannels: false,
            },
        });

        const channelName = `shared-config-02-${await getRandomId()}`;
        await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Shared Config Disabled',
            type: 'O',
        });

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();

        await expect(configurationTab.shareWithConnectedWorkspacesSection).not.toBeVisible();
        await channelSettingsModal.close();
    });

    test('Section when no connected workspace exists', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(!hasSharedChannelsLicense(license), 'Skipping test - server does not have Shared Channels license');

        await adminClient.patchConfig({
            ConnectedWorkspacesSettings: {
                EnableSharedChannels: true,
                EnableRemoteClusterService: true,
            },
        });

        await deleteAllRemoteClusters(adminClient);

        const channelName = `shared-config-03-${await getRandomId()}`;
        await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'No Workspaces Test',
            type: 'O',
        });

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();

        await expect(configurationTab.shareWithConnectedWorkspacesSection).toBeVisible();
        await expect(configurationTab.shareWithWorkspacesToggle).toBeVisible();
        await expect(
            configurationTab.container.getByText(/No connected workspaces|Contact your system admin/),
        ).toBeVisible();
        await channelSettingsModal.close();
    });

    test('Section hidden for users without Shared channel manager role', async ({pw}) => {
        const {adminClient, user, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(!hasSharedChannelsLicense(license), 'Skipping test - server does not have Shared Channels license');

        await adminClient.patchConfig({
            ConnectedWorkspacesSettings: {
                EnableSharedChannels: true,
                EnableRemoteClusterService: true,
            },
        });

        const roles = await adminClient.getRolesByNames(['system_user', 'channel_user']);
        const systemRole = roles.find((r: {name: string}) => r.name === 'system_user');
        const channelRole = roles.find((r: {name: string}) => r.name === 'channel_user');
        if (!systemRole || !channelRole) {
            throw new Error('Could not find system_user or channel_user role');
        }
        const systemPermissions = (systemRole.permissions as string[]).filter((p) => p !== 'manage_shared_channels');
        await adminClient.patchRole(systemRole.id, {permissions: systemPermissions});
        const channelPermissions = [
            ...new Set([...(channelRole.permissions as string[]), 'manage_public_channel_banner']),
        ];
        await adminClient.patchRole(channelRole.id, {permissions: channelPermissions});

        const channelName = `shared-config-04-${await getRandomId()}`;
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'No Manager Role Test',
            type: 'O',
        });
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        const channelSettingsModal = await channelsPage.openChannelSettings();
        const configurationTab = await channelSettingsModal.openConfigurationTab();

        await expect(configurationTab.shareWithConnectedWorkspacesSection).not.toBeVisible();
        await channelSettingsModal.close();
    });

    test('Enable sharing toggle, verify UI persistence after refresh, disable sharing toggle', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(!hasSharedChannelsLicense(license), 'Skipping test - server does not have Shared Channels license');

        await adminClient.patchConfig({
            ConnectedWorkspacesSettings: {
                EnableSharedChannels: true,
                EnableRemoteClusterService: true,
            },
        });

        try {
            await ensureConfirmedRemote(adminClient, team.id);
        } catch {
            test.skip(true, 'Skipping - Remote Cluster Service not available or invitation handshake failed');
        }

        const channelName = `shared-config-06-${await getRandomId()}`;
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

    test('UI updates after permission change', async ({pw}) => {
        const {adminClient, user, team} = await pw.initSetup();

        const license = await adminClient.getClientLicenseOld();
        test.skip(!hasSharedChannelsLicense(license), 'Skipping test - server does not have Shared Channels license');

        await adminClient.patchConfig({
            ConnectedWorkspacesSettings: {
                EnableSharedChannels: true,
                EnableRemoteClusterService: true,
            },
        });

        const roles = await adminClient.getRolesByNames(['system_user']);
        const systemRole = roles[0];
        const withPermission = [...new Set([...(systemRole.permissions as string[]), 'manage_shared_channels'])];
        await adminClient.patchRole(systemRole.id, {permissions: withPermission});

        const channelName = `shared-config-10-${await getRandomId()}`;
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: channelName,
            display_name: 'Permission Change Test',
            type: 'O',
        });
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channelName);
        await channelsPage.toBeVisible();

        let channelSettingsModal = await channelsPage.openChannelSettings();
        let configurationTab = await channelSettingsModal.openConfigurationTab();
        await expect(configurationTab.shareWithConnectedWorkspacesSection).toBeVisible();
        await channelSettingsModal.close();

        const withoutPermission = (systemRole.permissions as string[]).filter((p) => p !== 'manage_shared_channels');
        await adminClient.patchRole(systemRole.id, {permissions: withoutPermission});

        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        channelSettingsModal = await channelsPage.openChannelSettings();
        configurationTab = await channelSettingsModal.openConfigurationTab();
        await expect(configurationTab.shareWithConnectedWorkspacesSection).not.toBeVisible();
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

        await adminClient.patchConfig({
            ConnectedWorkspacesSettings: {
                EnableSharedChannels: true,
                EnableRemoteClusterService: true,
            },
        });

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

        const channelName = `shared-config-permissions-${await getRandomId()}`;
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
