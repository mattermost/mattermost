// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for Channel Settings → Configuration → Share with connected workspaces
 * Covers: TC-WEB-01, TC-WEB-02, TC-WEB-03, TC-WEB-04, TC-WEB-06, TC-WEB-07, TC-WEB-08, TC-WEB-09, TC-WEB-10
 */

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {sharedChannelsEnabledConfig, skipUnlessSharedChannelsLicense} from './support';

test.describe('Shared channel configuration', () => {
    test('Section hidden for users without Shared channel manager role', async ({pw}) => {
        const {adminClient, user, team} = await pw.initSetup();

        await skipUnlessSharedChannelsLicense(adminClient);

        await adminClient.patchConfig(sharedChannelsEnabledConfig);

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

        const channelName = `shared-config-04-${getRandomId()}`;
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

    test('UI updates after permission change', async ({pw}) => {
        const {adminClient, user, team} = await pw.initSetup();

        await skipUnlessSharedChannelsLicense(adminClient);

        await adminClient.patchConfig(sharedChannelsEnabledConfig);

        const roles = await adminClient.getRolesByNames(['system_user']);
        const systemRole = roles[0];
        const withPermission = [...new Set([...(systemRole.permissions as string[]), 'manage_shared_channels'])];
        await adminClient.patchRole(systemRole.id, {permissions: withPermission});

        const channelName = `shared-config-10-${getRandomId()}`;
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
});
