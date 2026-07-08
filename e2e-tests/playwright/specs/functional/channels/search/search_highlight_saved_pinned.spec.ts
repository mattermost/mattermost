// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
