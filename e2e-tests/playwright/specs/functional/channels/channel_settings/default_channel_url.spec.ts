// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, closeChannelSettings, openChannelSettingsInfoTab, Api, settle} from '@mattermost/playwright-lib';

const DEFAULT_CHANNEL_URL_LOCKED_TEXT = 'The URL of the default channel cannot be changed.';

/**
 * @objective Verify that Channel Settings does not offer a URL edit for the default channel, whose URL the
 * server always rejects, while its display name can still be saved.
 * @reference MM-67612
 */
test(
    'does not offer a URL edit for the default channel but still saves its display name',
    {tag: '@channel_settings'},
    async ({pw}) => {
        const {adminUser, adminClient, team} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(adminUser);

        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Open the Channel Settings modal on the Info tab
        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
        const infoSettings = await openChannelSettingsInfoTab(channelSettings);

        // * Verify the URL is shown read-only, with no way to edit it and an explanation why
        await expect(infoSettings.url.labelText).toContainText('town-square');
        await expect(infoSettings.url.editButton).not.toBeVisible();
        await expect(infoSettings.url.valueTextbox).not.toBeVisible();
        await expect(infoSettings.url.helpText).toHaveText(DEFAULT_CHANNEL_URL_LOCKED_TEXT);

        // # Rename the display name, which the server does allow on the default channel
        await infoSettings.name.container.fill('Company Wide');
        await settle(channelSettings.savePanel.saveButton, {wait: Api.PatchChannel}).click();

        // * Verify the save succeeded: the save panel disappears rather than showing a form error
        await expect(channelSettings.savePanel.saveButton).not.toBeVisible();
        await closeChannelSettings(channelSettings);
        await expect(app.channelHeader.openMenuButton).toContainText('Company Wide');

        // * Verify the server kept the default channel URL and applied the new display name
        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        expect(channel.name).toBe('town-square');
        expect(channel.display_name).toBe('Company Wide');
    },
);

/**
 * @objective Verify that an ordinary channel is unaffected by the default-channel restriction and its URL
 * can still be changed from Channel Settings.
 * @reference MM-67612
 */
test('allows the URL of an ordinary channel to be changed', {tag: '@channel_settings'}, async ({pw}) => {
    const {adminUser, adminClient, team} = await pw.initSetup();
    const createdChannel = await adminClient.createPublicChannel(team.id, 'Ordinary Channel');

    const {app} = await pw.testBrowser.login(adminUser);
    await app.channelsPage.goto({team, channel: createdChannel.name});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the Channel Settings modal on the Info tab
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
    const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
    const infoSettings = await openChannelSettingsInfoTab(channelSettings);

    // * Verify an ordinary channel is not affected by the default-channel restriction
    await expect(infoSettings.url.helpText).not.toBeVisible();
    await expect(infoSettings.url.editButton).toBeVisible();

    // # Change the channel URL and save
    const updatedUrl = `renamed-${pw.random.id()}`;
    await infoSettings.url.editButton.click();
    await expect(infoSettings.url.valueTextbox).toBeVisible();
    await infoSettings.url.valueTextbox.fill(updatedUrl);
    await settle(channelSettings.savePanel.saveButton, {wait: Api.PatchChannel}).click();

    // * Verify the save succeeded: the save panel disappears rather than showing a form error
    await expect(channelSettings.savePanel.saveButton).not.toBeVisible();
    await closeChannelSettings(channelSettings);

    const channel = await adminClient.getChannel(createdChannel.id);
    expect(channel.name).toBe(updatedUrl);
});
