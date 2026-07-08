// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the top navigation buttons remain clickable and open their panels while focus is in the search box.
 */
test('MM-T367 clicks top navigation buttons while the search box has focus', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // The open search box traps focus and marks the top-right header buttons aria-hidden, so match hidden too.
    // (The channel-info button lives in the channel header, which the search popup overlays, so it is not
    // reachable while the search box is open in the current UI and is intentionally not exercised here.)
    const recentMentionsButton = page.getByRole('button', {name: 'Recent mentions', includeHidden: true});
    const savedMessagesButton = page.getByRole('button', {name: 'Saved messages', includeHidden: true});

    // # Put focus in the search box and type text, then click Recent mentions
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();
    await channelsPage.searchBox.searchInput.fill('some text');
    await recentMentionsButton.click();

    // * Verify the Recent Mentions panel opens
    await channelsPage.searchResultsPanel.toHaveHeading('Recent Mentions');

    // # Focus the search box again and click Saved messages
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();
    await channelsPage.searchBox.searchInput.fill('some text');
    await savedMessagesButton.click();

    // * Verify the Saved messages panel opens
    await expect(
        channelsPage.searchResultsPanel.container.getByRole('heading', {name: 'Saved messages'}).first(),
    ).toBeVisible();
});
