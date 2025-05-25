// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('MM-64155 search box clear button should not leave type badge after closing the search box', async ({pw}) => {
    // # Set up test with a user
    const {user} = await pw.initSetup();

    // # Log in as the test user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    // # Type something in the search box
    const searchText = 'abcdef';
    const {searchInput} = channelsPage.searchPopover;
    await searchInput.pressSequentially(searchText);

    // * Verify text was entered
    await expect(searchInput).toHaveValue(searchText);

    // # Click the clear button
    await channelsPage.searchPopover.clearIfPossible();

    // * Verify the input is cleared
    await expect(searchInput).toHaveValue('');

    // # Close the search box by clicking outside
    await channelsPage.page.click('body', {position: {x: 0, y: 0}});

    // * Verify the search box is closed
    await expect(channelsPage.searchPopover.container).not.toBeVisible();

    // * Verify there is no search type badge/chip in the search bar
    // The search type badge is rendered when searchType is either 'messages' or 'files'
    const searchTypeBadge = channelsPage.page.getByTestId('searchTypeBadge');
    await expect(searchTypeBadge).not.toBeVisible();
});
