// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('Search box suggestion must be case insensitive', async ({pw, pages}) => {
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    const channelsPage = new pages.ChannelsPage(page);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    const searchWord = 'off';
    const searchOutput = 'In:off-topic';
    const channelName = 'Off-Topic';

    // Should work as expected when using lowercase
    // # Type in lowercase "off" to search for the "Off-Topic" channel
    const {searchInput} = await channelsPage.searchPopover;
    await searchInput.pressSequentially(`In:${searchWord}`);

    // * The suggestion should be visible
    await expect(channelsPage.searchPopover.selectedSuggestion).toBeVisible();
    await expect(channelsPage.searchPopover.selectedSuggestion).toHaveText(channelName);

    // # Press Enter to select the suggestion and another Enter to search
    await searchInput.press('Enter');
    await searchInput.press('Enter');

    // * The search box should contain the selected suggestion
    await expect(channelsPage.globalHeader.searchBox.getByText(searchOutput, {exact: true})).toBeVisible();

    // Should work as expected when using uppercase
    // # Close then open the search UI
    await channelsPage.globalHeader.closeSearch();
    await channelsPage.globalHeader.openSearch();

    // # Type in uppercase "OFF" to search for the "Off-Topic" channel
    await searchInput.pressSequentially(`In:${searchWord.toUpperCase()}`);

    // * The suggestion should be visible
    await expect(channelsPage.searchPopover.selectedSuggestion).toBeVisible();
    await expect(channelsPage.searchPopover.selectedSuggestion).toHaveText(channelName);

    // # Press Enter to select the suggestion and another Enter to search
    await searchInput.press('Enter');
    await searchInput.press('Enter');

    // * The search box should contain the selected suggestion
    await expect(channelsPage.globalHeader.searchBox.getByText(searchOutput, {exact: true})).toBeVisible();
});
