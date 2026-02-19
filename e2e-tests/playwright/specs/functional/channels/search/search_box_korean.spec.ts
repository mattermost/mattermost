// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, koreanTestPhrase, test, typeKoreanWithIme} from '@mattermost/playwright-lib';

test('Search box handles Korean IME correctly', async ({pw, browserName}) => {
    test.skip(browserName !== 'chromium', 'The API used to test this is only available in Chrome');

    const {userClient, user, team} = await pw.initSetup();

    // # Create a channel named after the test phrase
    const testChannel = pw.random.channel({
        teamId: team.id,
        name: 'korean-test-channel',
        displayName: koreanTestPhrase,
    });
    await userClient.createChannel(testChannel);

    // # Log in a user in new browser context
    const {channelsPage, page} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    const {searchInput} = channelsPage.searchBox;
    await searchInput.focus();

    // # Type into the textbox
    const searchText = 'in:' + koreanTestPhrase.substring(0, 3);
    await typeKoreanWithIme(page, searchText);

    // * Verify that the text was typed correctly into the search box
    await expect(searchInput).toHaveValue(searchText);

    // * Verify that the channel is suggested
    await expect(channelsPage.searchBox.selectedSuggestion).toBeVisible();
    await expect(channelsPage.searchBox.selectedSuggestion).toHaveText(testChannel.display_name);
});
