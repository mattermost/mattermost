// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the search bar clear (X) button only appears when an active search term is
 * present, and that clearing the term removes the button and empties the input.
 */
test('shows and hides search clear button as the search term is added and cleared', {tag: '@search'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in a user in a new browser context and visit off-topic
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    const {globalHeader} = channelsPage;
    const {searchBox} = channelsPage;

    // * Verify the clear (X) button is not shown on an empty search bar
    await expect(globalHeader.searchClearButton).not.toBeVisible();

    // # Open the search box and run a search for "abc"
    await globalHeader.openSearch();
    await searchBox.searchInput.fill('abc');
    await searchBox.searchInput.press('Enter');

    // # Reopen the search box
    await globalHeader.openSearch();

    // * Verify the search input retains the entered text
    await expect(searchBox.searchInput).toHaveValue('abc');

    // # Close the search box using its close button
    await searchBox.searchBoxClose.click();

    // * Verify the clear (X) button is now visible in the collapsed search bar
    await expect(globalHeader.searchClearButton).toBeVisible();

    // # Click the clear (X) button to clear the active search term
    await globalHeader.searchClearButton.click();

    // * Verify the clear (X) button is hidden once the search term is cleared
    await expect(globalHeader.searchClearButton).not.toBeVisible();

    // # Reopen the search box
    await globalHeader.openSearch();

    // * Verify the search input is empty
    await expect(searchBox.searchInput).toHaveValue('');
});

/**
 * @objective Verify that running a search and then clicking the Saved messages button opens the
 * Saved messages panel in the right-hand sidebar.
 *
 * Note: The original Cypress test title references the search text not clearing, but the only
 * assertion it performs is that the Saved messages panel opens. This migration preserves that
 * exact verified behaviour. (Observed behaviour: opening Saved messages does clear the search
 * term; this is not asserted by the original test and is flagged for human review.)
 */
test(
    'MM-T368 - Text in search box should not clear when Pinned or Saved posts icon is clicked',
    {tag: '@search'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();

        // # Log in a user in a new browser context and visit off-topic
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const {globalHeader} = channelsPage;
        const {searchBox} = channelsPage;

        const searchText = `${Date.now()} : Hello world`;

        // # Open the search box and run a search
        await globalHeader.openSearch();
        await searchBox.searchInput.fill(searchText);
        await searchBox.searchInput.press('Enter');

        // # Click the Saved messages button in the global header
        await globalHeader.savedMessagesButton.click();

        // * Verify the Saved messages panel opens in the right-hand sidebar
        await expect(channelsPage.sidebarRight.container).toContainText('Saved messages');
    },
);
