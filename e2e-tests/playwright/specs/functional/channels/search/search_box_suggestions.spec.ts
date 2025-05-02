// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Search box suggestion must be case insensitive', async ({pw}) => {
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    const searchWord = 'off';
    const searchOutput = 'In:off-topic';
    const channelName = 'Off-Topic';

    // Should work as expected when using lowercase
    // # Type in lowercase "off" to search for the "Off-Topic" channel
    const {searchInput} = channelsPage.searchPopover;
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
    // # Open the search bar
    await channelsPage.globalHeader.openSearch();

    // # Clear its content
    await channelsPage.searchPopover.clearIfPossible();

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

test('remove extra whitespace when selecting a user', async ({pw}) => {
    // # Set up test with two users
    const {user, adminUser: admin} = await pw.initSetup();

    // # Log in as the test user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    // # Type "from:" followed by multiple spaces
    const {searchInput} = channelsPage.searchPopover;
    await searchInput.pressSequentially(`from:    ${admin.username}`);

    // * The suggestion should be visible
    await expect(channelsPage.searchPopover.selectedSuggestion).toBeVisible();
    await expect(channelsPage.searchPopover.selectedSuggestion).toHaveText(`@` + admin.username);

    // # Press enter to validate the selection
    await searchInput.press('Enter');

    // * Verify the search box shows "from:username" without extra spaces
    const expectedText = `from:${admin.username} `;
    await expect(searchInput).toHaveValue(expectedText);
});
