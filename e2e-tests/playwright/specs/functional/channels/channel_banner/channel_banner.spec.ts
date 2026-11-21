// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {
    Api,
    closeChannelSettings,
    createChannelFromModal,
    expect,
    openChannelSettingsConfigurationTab,
    settle,
    test,
    type App,
} from '@mattermost/playwright-lib';

type Banner = App['center']['channelBanner'];

/** `77DD88` or `#77DD88` -> `rgb(119, 221, 136)`, as the browser reports a background colour. */
function hexToRgb(hex: string): string {
    const value = hex.replace(/^#/, '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
    return `rgb(${r}, ${g}, ${b})`;
}

/** The banner shows exactly this text on this background colour. */
async function expectBanner(banner: Banner, text: string, color: string) {
    await expect(banner).toBeVisible();
    await expect(banner).toHaveText(text);
    await expect(banner).toHaveCSS('background-color', hexToRgb(color));
}

/** The element's box on screen, failing when it has none (not rendered). */
async function boxOf(element: Locator) {
    const box = await element.boundingBox();
    if (!box) {
        throw new Error('The element has no bounding box');
    }
    return box;
}

/**
 * The element lies fully inside the banner's content area (its box minus its padding). Bounding boxes are not clipped
 * by a parent's overflow, so an element that reaches into the padding would be cut off on screen.
 */
async function expectInsideBanner(banner: Banner, element: Locator) {
    const EPSILON = 0.5;
    await expect(element).toBeVisible();
    const box = await boxOf(banner.locator);
    const inner = await boxOf(element);
    const padding = await banner.locator.evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return {
            top: parseFloat(styles.paddingTop),
            bottom: parseFloat(styles.paddingBottom),
            left: parseFloat(styles.paddingLeft),
            right: parseFloat(styles.paddingRight),
        };
    });
    expect(inner.y).toBeGreaterThanOrEqual(box.y + padding.top - EPSILON);
    expect(inner.y + inner.height).toBeLessThanOrEqual(box.y + box.height - padding.bottom + EPSILON);
    expect(inner.x).toBeGreaterThanOrEqual(box.x + padding.left - EPSILON);
    expect(inner.x + inner.width).toBeLessThanOrEqual(box.x + box.width - padding.right + EPSILON);
}

const EMOJI_SIZE = 16;

test('Should show channel banner when configured', async ({pw}) => {
    // This suite exercises the legacy AdvancedTextbox banner editor, which only
    // renders when ChannelAttributes is off.
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {app} = await pw.testBrowser.login(adminUser);
    await app.page.goto('/');
    await expect(app.center.postCreate).toBeVisible();

    await createChannelFromModal(app, pw.random.id(), 'O');

    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    let channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    let configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerText.container.fill('Example channel banner text');
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await expectBanner(app.center.channelBanner, 'Example channel banner text', '#77DD88');

    // Now we'll disable the channel banner
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);
    await configurationTab.bannerSwitch.set(false);
    await expect(configurationTab.bannerSwitch).not.toBeOn();

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await expect(app.center.channelBanner).not.toBeVisible();

    // re-enabling channel banner should already have
    // the previously configured text and color
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);
    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    await expectBanner(app.center.channelBanner, 'Example channel banner text', '#77DD88');
});

test('Should show channel banner in thread view', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {app} = await pw.testBrowser.login(adminUser);
    await app.page.goto('/');
    await expect(app.center.postCreate).toBeVisible();

    await createChannelFromModal(app, pw.random.id(), 'O');

    // Configure the channel banner
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerText.container.fill('Thread banner text');
    await configurationTab.bannerColor.valueTextbox.fill('AA33BB');

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    // Post a message and open the thread
    await app.center.postCreate.message.container.fill('Message to create a thread');
    const created = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    const post = app.center.postList.post(created);
    await post.container.hover();
    await post.menu.replyButton.click();

    await expect(app.rhs.container).toBeVisible();
    await expectBanner(app.rhs.thread.channelBanner, 'Thread banner text', '#AA33BB');
});

test('Should not show channel banner in thread view when disabled', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {app} = await pw.testBrowser.login(adminUser);
    await app.page.goto('/');
    await expect(app.center.postCreate).toBeVisible();

    await createChannelFromModal(app, pw.random.id(), 'O');
    await expect(app.center.postCreate).toBeVisible();

    await app.center.postCreate.message.container.fill('Message without banner');
    const created = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    const post = app.center.postList.post(created);
    await post.container.hover();
    await post.menu.replyButton.click();

    await expect(app.rhs.container).toBeVisible();
    await expect(app.rhs.thread.channelBanner).not.toBeVisible();
});

test('Should render image emoticons without clipping', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {app} = await pw.testBrowser.login(adminUser);
    await app.page.goto('/');
    await expect(app.center.postCreate).toBeVisible();

    await createChannelFromModal(app, pw.random.id(), 'O');

    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');
    // :dog: is in Mattermost's emoji map → renders as .emoticon (background-image).
    // Unicode emojis that are also in the map (e.g. 🐶) follow the same path.
    await configurationTab.bannerText.container.fill('Hello :dog:');
    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    const emoji = app.center.channelBanner.markdown.emoji('dog').locator;
    await expect(emoji).toHaveCSS('width', `${EMOJI_SIZE}px`);
    await expect(emoji).toHaveCSS('height', `${EMOJI_SIZE}px`);
    await expectInsideBanner(app.center.channelBanner, emoji);
});

test('Should render unsupported unicode emoji without clipping', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {app} = await pw.testBrowser.login(adminUser);
    await app.page.goto('/');
    await expect(app.center.postCreate).toBeVisible();

    await createChannelFromModal(app, pw.random.id(), 'O');

    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');
    // 🫠 (U+1FAE0, Unicode 14.0) is above Mattermost's emoji map ceiling (1FAD6)
    // so it falls through to the .emoticon--unicode span path.
    await configurationTab.bannerText.container.fill('Hello 🫠');
    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    const emoji = app.center.channelBanner.markdown.unicodeEmojiText;
    await expect(emoji).toHaveCSS('font-size', `${EMOJI_SIZE}px`);
    await expectInsideBanner(app.center.channelBanner, emoji.locator);
});

test('Should render text with descenders without clipping', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {app} = await pw.testBrowser.login(adminUser);
    await app.page.goto('/');
    await expect(app.center.postCreate).toBeVisible();

    await createChannelFromModal(app, pw.random.id(), 'O');

    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
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

    await expectInsideBanner(app.center.channelBanner, app.center.channelBanner.textText.locator);
});

test('Should render markdown', async ({pw}) => {
    await pw.ensureFeatureFlag('ChannelAttributes', false);

    const {adminUser, adminClient} = await pw.initSetup();
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have Enterprise Advanced license');

    const {app} = await pw.testBrowser.login(adminUser);
    await app.page.goto('/');
    await expect(app.center.postCreate).toBeVisible();

    await createChannelFromModal(app, pw.random.id(), 'O');

    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    const configurationTab = await openChannelSettingsConfigurationTab(channelSettingsModal);

    await configurationTab.bannerSwitch.set(true);
    await expect(configurationTab.bannerSwitch).toBeOn();
    await configurationTab.bannerText.container.fill('**bold** *italic* ~~strikethrough~~');
    await configurationTab.bannerColor.valueTextbox.fill('77DD88');

    await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();
    await closeChannelSettings(channelSettingsModal);

    // markdown emphasis renders as plain <strong> inside the banner text, with no testid of its own
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- rendered markdown <strong> element: it cannot take a testid
    await expect(app.center.channelBanner.locator.locator('strong')).toHaveText('bold');
    // markdown emphasis renders as plain <em> inside the banner text, with no testid of its own
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- rendered markdown <em> element: it cannot take a testid
    await expect(app.center.channelBanner.locator.locator('em')).toHaveText('italic');
    // markdown emphasis renders as plain <del> inside the banner text, with no testid of its own
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- rendered markdown <del> element: it cannot take a testid
    await expect(app.center.channelBanner.locator.locator('del')).toHaveText('strikethrough');
});
