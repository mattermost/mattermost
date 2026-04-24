// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaywrightExtended, test} from '@mattermost/playwright-lib';

/**
 * Shared helpers for channel banner spec files.
 *
 * All channel banner tests require the Enterprise Advanced license and
 * follow the same flow: initialize, login as admin, create a new channel,
 * and open the Channel Settings → Configuration tab.
 */

/**
 * Initializes an admin session, skips the test if the server does not have
 * the Enterprise Advanced license, creates a new public channel and opens
 * the Channel Settings → Configuration tab.
 */
export async function setupChannelWithConfigurationTab(pw: PlaywrightExtended) {
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await channelSettingsModal.openConfigurationTab();

    return {channelsPage, channelSettingsModal, configurationTab};
}
