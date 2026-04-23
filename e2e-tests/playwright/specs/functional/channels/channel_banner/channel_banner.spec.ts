// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

const EMOJI_SIZE = 16;

test('Should show channel banner when configured', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    let channelSettingsModal = await channelsPage.openChannelSettings();
    let configurationTab = await channelSettingsModal.openConfigurationTab();

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
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    // Configure the channel banner
    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await channelSettingsModal.openConfigurationTab();

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

test('Should render image emoticons without clipping', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await channelSettingsModal.openConfigurationTab();

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerTextColor('77DD88');
    // :dog: is in Mattermost's emoji map → renders as .emoticon (background-image).
    // Unicode emojis that are also in the map (e.g. 🐶) follow the same path.
    await configurationTab.setChannelBannerText('Hello :dog:');
    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerImageEmojiSize(EMOJI_SIZE);
});

test('Should render unsupported unicode emoji without clipping', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await channelSettingsModal.openConfigurationTab();

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerTextColor('77DD88');
    // 🫠 (U+1FAE0, Unicode 14.0) is above Mattermost's emoji map ceiling (1FAD6)
    // so it falls through to the .emoticon--unicode span path.
    await configurationTab.setChannelBannerText('Hello 🫠');
    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerUnicodeEmojiSize(EMOJI_SIZE);
});

test('Should render text with descenders without clipping', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await channelSettingsModal.openConfigurationTab();

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerTextColor('77DD88');
    // Characters with descenders (parts that extend below the baseline).
    // Previously clipped because line-height equalled font-size (13px), leaving
    // no room below the baseline for g, j, p, q, y etc.
    await configurationTab.setChannelBannerText('YyGgQqJj');
    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerTextNotClipped();
});

test('Should render markdown', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await channelSettingsModal.openConfigurationTab();

    await configurationTab.enableChannelBanner();
    await configurationTab.setChannelBannerText('**bold** *italic* ~~strikethrough~~');
    await configurationTab.setChannelBannerTextColor('77DD88');

    await configurationTab.save();
    await channelSettingsModal.close();

    await channelsPage.centerView.assertChannelBannerHasBoldText('bold');
    await channelsPage.centerView.assertChannelBannerHasItalicText('italic');
    await channelsPage.centerView.assertChannelBannerHasStrikethroughText('strikethrough');
});
