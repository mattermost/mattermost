// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the "in:" search autocomplete shows a renamed channel by both its new display name and
 * its original handle, so it stays findable after a display-name change.
 */
test(
    'MM-T1449 shows the channel display name and handle in the in: search autocomplete',
    {tag: '@search'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();

        // # Create a public channel whose handle differs from its display name, then add the user
        const id = pw.random.id();
        const handle = `original-${id}`;
        const updatedName = `Updated ${id}`;
        const channel = await adminClient.createPublicChannel(team.id, `Original ${id}`, handle);
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Rename the channel's display name via Channel Settings
        const channelSettings = await channelsPage.openChannelSettings();
        const infoSettings = await channelSettings.openInfoTab();
        await infoSettings.updateName(updatedName);
        await channelSettings.save();
        await channelSettings.close();
        await channelsPage.centerView.header.toHaveTitle(updatedName);

        // # Open search and type an "in:" filter matching the channel's original handle
        await channelsPage.globalHeader.openSearch();
        await channelsPage.searchBox.toBeVisible();
        await channelsPage.searchBox.searchInput.fill('in:');
        await channelsPage.searchBox.searchInput.pressSequentially(handle);

        // * Verify the autocomplete shows the channel by its new display name and its original handle
        const suggestion = channelsPage.searchBox.container.getByRole('option').filter({hasText: updatedName});
        await expect(suggestion).toBeVisible();
        await expect(suggestion).toContainText(updatedName);
        await expect(suggestion).toContainText(`~${handle}`);
    },
);
