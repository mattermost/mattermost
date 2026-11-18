// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify clearing the search box and closing it leaves no search type badge in the header.
 */
test('MM-64155 search box clear button should not leave type badge after closing the search box', async ({pw}) => {
    // # Set up test with a user
    const {team, user, townSquare} = await pw.initSetup();

    // # Log in as the test user and open the town square
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open the search box from the header
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);

    // # Type something in the search box
    const searchText = 'abcdef';
    const input = app.searchBox.inputSearchbox;
    await input.type(searchText);

    // * Verify text was entered
    await expect(input).toHaveValue(searchText);

    // # Click the clear button
    await app.searchBox.clearButton.click();

    // * Verify the input is cleared
    await expect(input).toHaveValue('');

    // # Close the search box by clicking outside it
    await page.mouse.click(0, 0);

    // * Verify the search box is closed
    await expect(app.searchBox).not.toBeVisible();

    // * Verify there is no search type badge in the header's search bar
    // (the badge renders when the search type is messages or files)
    await expect(app.globalHeader.search.typeBadgeText).not.toBeVisible();
});
