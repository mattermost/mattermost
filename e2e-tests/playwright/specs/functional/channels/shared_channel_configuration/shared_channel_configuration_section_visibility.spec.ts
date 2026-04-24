// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for Channel Settings → Configuration → Share with connected workspaces
 * Covers: TC-WEB-01, TC-WEB-02, TC-WEB-03, TC-WEB-04, TC-WEB-06, TC-WEB-07, TC-WEB-08, TC-WEB-09, TC-WEB-10
 */

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {sharedChannelsEnabledConfig, skipUnlessSharedChannelsLicense} from './support';

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

test.describe('Shared channel configuration', () => {
    test('Section visible when all conditions are met', async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();

        await skipUnlessSharedChannelsLicense(adminClient);

        await adminClient.patchConfig(sharedChannelsEnabledConfig);

        const channelName = `shared-config-01-${getRandomId()}`;
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

        await skipUnlessSharedChannelsLicense(adminClient);

        await adminClient.patchConfig({
            ConnectedWorkspacesSettings: {
                EnableSharedChannels: false,
            },
        });

        const channelName = `shared-config-02-${getRandomId()}`;
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

        await skipUnlessSharedChannelsLicense(adminClient);

        await adminClient.patchConfig(sharedChannelsEnabledConfig);

        await deleteAllRemoteClusters(adminClient);

        const channelName = `shared-config-03-${getRandomId()}`;
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
});
