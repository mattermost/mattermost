// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
        const {channelsPage} = await pw.testBrowser.login(adminUser);

        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open the Channel Settings modal on the Info tab
        const channelSettings = await channelsPage.openChannelSettings();
        const infoSettings = await channelSettings.openInfoTab();

        // * Verify the URL is shown read-only, with no way to edit it and an explanation why
        await expect(infoSettings.urlLabel).toContainText('town-square');
        await expect(infoSettings.urlEditButton).not.toBeVisible();
        await expect(infoSettings.urlInput).not.toBeVisible();
        await expect(infoSettings.container.getByText(DEFAULT_CHANNEL_URL_LOCKED_TEXT)).toBeVisible();

        // # Rename the display name, which the server does allow on the default channel
        await infoSettings.updateName('Company Wide');
        await channelSettings.save();

        // * Verify the save succeeded: the save panel disappears rather than showing a form error
        await expect(channelSettings.saveButton).not.toBeVisible();
        await channelSettings.close();
        await channelsPage.centerView.header.toHaveTitle('Company Wide');

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

    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto(team.name, createdChannel.name);
    await channelsPage.toBeVisible();

    // # Open the Channel Settings modal on the Info tab
    const channelSettings = await channelsPage.openChannelSettings();
    const infoSettings = await channelSettings.openInfoTab();

    // * Verify an ordinary channel is not affected by the default-channel restriction
    await expect(infoSettings.container.getByText(DEFAULT_CHANNEL_URL_LOCKED_TEXT)).not.toBeVisible();
    await expect(infoSettings.urlEditButton).toBeVisible();

    // # Change the channel URL and save
    const updatedUrl = `renamed-${pw.random.id()}`;
    await infoSettings.updateUrl(updatedUrl);
    await channelSettings.save();

    // * Verify the save succeeded: the save panel disappears rather than showing a form error
    await expect(channelSettings.saveButton).not.toBeVisible();
    await channelSettings.close();

    const channel = await adminClient.getChannel(createdChannel.id);
    expect(channel.name).toBe(updatedUrl);
});
