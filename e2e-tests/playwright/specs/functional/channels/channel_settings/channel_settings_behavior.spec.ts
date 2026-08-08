// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify channel URL validation rejects a duplicate URL while leaving the current URL unchanged, then accepts a unique URL.
 */
test('MM-T882 validates channel URL changes', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'URL Validation');
    await adminClient.addToChannel(user.id, channel.id);
    const uniqueUrl = `another-town-square-${pw.random.id()}`.toLowerCase();

    // # Open Channel Settings and change the display name without changing the URL
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const channelSettings = await channelsPage.openChannelSettings();
    const infoSettings = await channelSettings.openInfoTab();
    await infoSettings.updateName('town-square');

    // # Explicitly edit the URL to use an existing channel URL
    await infoSettings.openUrlEditor();
    await infoSettings.updateUrl('town-square');
    await channelSettings.save();

    // * Verify the duplicate URL error appears and navigation remains on the original URL
    await expect(infoSettings.duplicateUrlAlert).toContainText(
        'A channel with that name already exists on the same team.',
    );
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}$`));

    // # Replace the duplicate URL with a unique URL and save
    await infoSettings.updateUrl(uniqueUrl);
    await channelSettings.save();

    // * Verify the browser navigates to the updated channel URL
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${uniqueUrl}$`));
});

/**
 * @objective Verify a channel can be muted and unmuted from its channel menu.
 */
test('MM-T887 mutes and unmutes a channel from the channel menu', async ({pw}) => {
    const {team, user} = await pw.initSetup();

    // # Open Off-Topic and mute it from the channel menu
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    let channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.muteToggle.click();

    // * Verify the sidebar item is muted and the header offers to unmute the channel
    await channelsPage.sidebarLeft.assertItemMuted('off-topic');
    await expect(channelsPage.centerView.header.unmuteButton).toBeVisible();

    // # Reopen the channel menu and unmute the channel
    channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.muteToggle.click();

    // * Verify the sidebar item and header return to their unmuted state
    await channelsPage.sidebarLeft.assertItemNotMuted('off-topic');
    await expect(channelsPage.centerView.header.unmuteButton).not.toBeVisible();
});
