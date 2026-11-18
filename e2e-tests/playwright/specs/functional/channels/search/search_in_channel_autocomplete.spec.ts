// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, closeChannelSettings, expect, openChannelSettingsInfoTab, settle, test} from '@mattermost/playwright-lib';

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

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});

        // # Rename the channel's display name via Channel Settings
        await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
        const channelSettings = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(app.channelSettingsModal);
        const infoSettings = await openChannelSettingsInfoTab(channelSettings);
        await infoSettings.name.container.fill(updatedName);
        await settle(channelSettings.savePanel.saveButton, {wait: Api.PatchChannel}).click();
        await closeChannelSettings(channelSettings);
        await expect(app.channelHeader.openMenuButton).toContainText(updatedName);

        // # Open search and type an "in:" filter matching the channel's original handle
        const input = app.searchBox.inputSearchbox;
        await app.globalHeader.search.openButton.clickTo(input);
        await input.fill('in:');
        await input.type(handle);

        // * Verify the autocomplete offers the channel by its handle (the client adds a suffix to the one asked
        // for), showing its new display name and the handle
        const suggestion = app.searchBox.suggestions.suggestion(channel.name);
        await expect(suggestion).toBeVisible();
        await expect(suggestion).toContainText(updatedName);
        await expect(suggestion).toContainText(`~${handle}`);
    },
);
