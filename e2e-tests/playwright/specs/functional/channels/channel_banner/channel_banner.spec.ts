// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expect,
    test,
    closeChannelSettings,
    openChannelSettingsConfigurationTab,
    Api,
    settle,
} from '@mattermost/playwright-lib';

const EMOJI_SIZE = 16;

test('Should show channel banner when configured', async ({pw}) => {
    // This suite exercises the legacy AdvancedTextbox banner editor, which only
    // renders when ChannelAttributes is off.
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    let channelSettingsModal = await channelsPage.openChannelSettings();
    let configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerText.container.fill('Example channel banner text');
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await channelsPage.centerView.assertChannelBanner('Example channel banner text', '#77DD88');

    // Now we'll disable the channel banner
    channelSettingsModal = await channelsPage.openChannelSettings();
    configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);
    await configurationTab.bannerSwitch.set(false);
    await expect(configurationTab.bannerSwitch).not.toBeOn();

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await channelsPage.centerView.assertChannelBannerNotVisible();

    // re-enabling channel banner should already have
    // the previously configured text and color
    channelSettingsModal = await channelsPage.openChannelSettings();
    configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);
    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await channelsPage.centerView.assertChannelBanner('Example channel banner text', '#77DD88');
});

test('Should show channel banner in thread view', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    // Configure the channel banner
    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerText.container.fill('Thread banner text');
    await configurationTab.bannerColor.valueTextbox.fill('AA33BB');

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    // Post a message and open the thread
    await channelsPage.centerView.postMessage('Message to create a thread');
    const post = await channelsPage.centerView.getLastPost();
    await post.reply();

    await expect(channelsPage.sidebarRight.container).toBeVisible();
    await channelsPage.sidebarRight.assertChannelBanner('Thread banner text', '#AA33BB');
});

test('Should not show channel banner in thread view when disabled', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

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
    await expect(channelsPage.centerView.postCreate.input).toBeFocused();
    await channelsPage.centerView.postCreate.input.pressSequentially('Message without banner');
    await channelsPage.centerView.postCreate.sendMessage();
    const post = await channelsPage.centerView.getLastPost();
    await post.reply();

    await expect(channelsPage.sidebarRight.container).toBeVisible();
    await channelsPage.sidebarRight.assertChannelBannerNotVisible();
});

test('Should render image emoticons without clipping', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');
    // :dog: is in Mattermost's emoji map → renders as .emoticon (background-image).
    // Unicode emojis that are also in the map (e.g. 🐶) follow the same path.
    await configurationTab.bannerText.container.fill('Hello :dog:');
    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await channelsPage.centerView.assertChannelBannerImageEmojiSize(EMOJI_SIZE);
});

test('Should render unsupported unicode emoji without clipping', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');
    // 🫠 (U+1FAE0, Unicode 14.0) is above Mattermost's emoji map ceiling (1FAD6)
    // so it falls through to the .emoticon--unicode span path.
    await configurationTab.bannerText.container.fill('Hello 🫠');
    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await channelsPage.centerView.assertChannelBannerUnicodeEmojiSize(EMOJI_SIZE);
});

test('Should render text with descenders without clipping', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');
    // Characters with descenders (parts that extend below the baseline).
    // Previously clipped because line-height equalled font-size (13px), leaving
    // no room below the baseline for g, j, p, q, y etc.
    await configurationTab.bannerText.container.fill('YyGgQqJj');
    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await channelsPage.centerView.assertChannelBannerTextNotClipped();
});

test('Should render markdown', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.newChannel(pw.random.id(), 'O');

    const channelSettingsModal = await channelsPage.openChannelSettings();
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerText.container.fill('**bold** *italic* ~~strikethrough~~');
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await channelsPage.centerView.assertChannelBannerHasBoldText('bold');
    await channelsPage.centerView.assertChannelBannerHasItalicText('italic');
    await channelsPage.centerView.assertChannelBannerHasStrikethroughText('strikethrough');
});
