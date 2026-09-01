// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that searching with trailing double quotes highlights only the searched terms, with no unexpected highlighting.
 */
test('MM-T354 highlights only the searched terms when searching with double quotes', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message that contains the two search words plus an unrelated unique word
    const marker = `zzz${pw.random.id()}`;
    await channelsPage.postMessage(`test tool ${marker}`);

    // # Search using the two words followed by an empty double-quoted phrase
    await channelsPage.searchFor('test tool ""');

    // * Verify the message is returned
    await channelsPage.searchResultsPanel.toContainText(marker);

    // * Verify only the two searched words are highlighted (no unexpected highlighting)
    const highlights = channelsPage.searchResultsPanel.getHighlightedTerms();
    await expect(highlights).toHaveCount(2);
    await expect(highlights.filter({hasText: 'test'})).toHaveCount(1);
    await expect(highlights.filter({hasText: 'tool'})).toHaveCount(1);
    await expect(highlights.filter({hasText: marker})).toHaveCount(0);
});

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

/**
 * @objective Verify that search term highlighting appears in the search results panel but does not persist in the saved or pinned message panels.
 */
test(
    'MM-T372 does not persist search highlighting in the saved or pinned message panels',
    {tag: '@search'},
    async ({pw}) => {
        // # Create and log in as a test user, and open a channel
        const {user, team, adminClient} = await pw.initSetup();
        const channel = await adminClient.createPublicChannel(team.id, 'Highlight', 'highlight');
        await adminClient.addToChannel(user.id, channel.id);

        const token = `highlightterm${pw.random.id()}`;

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Post a message, then pin it to the channel and save it
        await channelsPage.postMessage(`test message ${token}`);
        const post = await channelsPage.getLastPost();
        await post.hover();
        await post.postMenu.openDotMenu();
        await channelsPage.postDotMenu.pinToChannelMenuItem.click();
        await post.hover();
        await post.postMenu.saveButton.click();

        // # Open the saved messages panel
        await channelsPage.globalHeader.openSavedMessages();
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.toContainText(token);

        // * Verify no search term is highlighted in the saved messages panel
        await expect(channelsPage.searchResultsPanel.getHighlightedTerms()).toHaveCount(0);

        // # Open the pinned messages panel
        await channelsPage.centerView.header.openPinnedMessages();
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.toContainText(token);

        // * Verify no search term is highlighted in the pinned messages panel
        await expect(channelsPage.searchResultsPanel.getHighlightedTerms()).toHaveCount(0);

        // # Search for the message so the term is highlighted
        await channelsPage.searchFor(token);
        await channelsPage.searchResultsPanel.toContainText(token);

        // * Verify the search term is highlighted in the search results panel
        await expect(channelsPage.searchResultsPanel.getHighlightedTerms().first()).toBeVisible();

        // # Close the search results panel, then reopen the saved messages panel
        await channelsPage.sidebarRight.close();
        await channelsPage.globalHeader.openSavedMessages();
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.toContainText(token);

        // * Verify the previously searched term is not highlighted in the saved messages panel
        await expect(channelsPage.searchResultsPanel.getHighlightedTerms()).toHaveCount(0);

        // # Reopen the pinned messages panel
        await channelsPage.centerView.header.openPinnedMessages();
        await channelsPage.searchResultsPanel.toBeVisible();
        await channelsPage.searchResultsPanel.toContainText(token);

        // * Verify the previously searched term is not highlighted in the pinned messages panel
        await expect(channelsPage.searchResultsPanel.getHighlightedTerms()).toHaveCount(0);
    },
);
