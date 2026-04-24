// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {setupChannelWithConfigurationTab} from './support';

test('Should show channel banner when configured', async ({pw}) => {
    const setup = await setupChannelWithConfigurationTab(pw);
    const {channelsPage} = setup;
    let {channelSettingsModal, configurationTab} = setup;

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerText('Example channel banner text');
    await configurationTab.setChannelBannerTextColor('77DD88');

    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBanner('Example channel banner text', '#77DD88');

    // Now we'll disable the channel banner
    channelSettingsModal = await channelsPage.openChannelSettings();
    configurationTab = await channelSettingsModal.openConfigurationTab();
    await configurationTab.disableChannelBanner();

    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerNotVisible();

    // re-enabling channel banner should already have
    // the previously configured text and color
    channelSettingsModal = await channelsPage.openChannelSettings();
    configurationTab = await channelSettingsModal.openConfigurationTab();
    await configurationTab.enableChannelBanner();

    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBanner('Example channel banner text', '#77DD88');
});

test('Should show channel banner in thread view', async ({pw}) => {
    const {channelsPage, channelSettingsModal, configurationTab} = await setupChannelWithConfigurationTab(pw);

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerText('Thread banner text');
    await configurationTab.setChannelBannerTextColor('AA33BB');

    await configurationTab.save();
    await channelSettingsModal.close();

    // Post a message and open the thread
    await channelsPage.centerView.postMessage('Message to create a thread');
    const post = await channelsPage.centerView.getLastPost();
    await post.reply();

    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.assertChannelBanner('Thread banner text', '#AA33BB');
});

test('Should not show channel banner in thread view when disabled', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');
    await channelsPage.centerView.toBeVisible();

    // Focus and type character-by-character to avoid React clearing a programmatic fill()
    await channelsPage.centerView.postCreate.input.click();
    await channelsPage.centerView.postCreate.input.pressSequentially('Message without banner');
    await channelsPage.centerView.postCreate.sendMessage();
    const post = await channelsPage.centerView.getLastPost();
    await post.reply();

    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.assertChannelBannerNotVisible();
});
