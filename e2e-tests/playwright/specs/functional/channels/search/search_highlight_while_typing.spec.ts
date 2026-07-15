// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the search result highlighting reflects the submitted query and does not change while the search input is edited before submitting again.
 */
test(
    'MM-T371 keeps search result highlighting unchanged while editing the search input',
    {tag: '@search'},
    async ({pw}) => {
        // # Create and log in as a test user
        const {user, team} = await pw.initSetup();
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Post a message that contains two distinct words
        const suffix = pw.random.id();
        const firstWord = `apple${suffix}`;
        const secondWord = `banana${suffix}`;
        await channelsPage.postMessage(`${firstWord} ${secondWord}`);

        // # Search for the first word
        await channelsPage.searchFor(firstWord);

        // * Verify the result contains both words but highlights only the searched (first) word
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.toContainText(secondWord);
        await expect(channelsPage.searchResultsPanel.getHighlightedTerms()).toHaveText([firstWord]);

        // # Reopen the search box and replace the query with the second word without submitting
        await channelsPage.globalHeader.openSearch();
        await channelsPage.searchBox.toBeVisible();
        const {searchInput} = channelsPage.searchBox;
        await expect(searchInput).toHaveValue(firstWord);
        await searchInput.fill(secondWord);

        // * Verify the search results still highlight the originally searched (first) word
        await expect(channelsPage.searchResultsPanel.getHighlightedTerms()).toHaveText([firstWord]);
    },
);
