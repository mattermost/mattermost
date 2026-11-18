// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, koreanTestPhrase, test, typeHangulWithIme} from '@mattermost/playwright-lib';

/**
 * @objective Verify the search box composes Korean typed through an IME and suggests the matching channel.
 */
test('Search box handles Korean IME correctly', async ({pw, browserName}) => {
    test.skip(browserName !== 'chromium', 'The API used to test this is only available in Chrome');

    const {userClient, user, team, townSquare} = await pw.initSetup();

    // # Create a channel named after the test phrase
    const testChannel = await userClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'korean-test-channel',
            displayName: koreanTestPhrase,
        }),
    );
    // # Log in and open a default channel
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open the search UI
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    const input = app.searchBox.inputSearchbox;
    await input.focus();
    await expect(input).toBeFocused();

    // # Type into the textbox
    const searchText = 'in:' + koreanTestPhrase.substring(0, 3);
    await typeHangulWithIme(page, searchText);

    // * Verify that the text was typed correctly into the search box
    await expect(input).toHaveValue(searchText);

    // * Verify that the channel is suggested and highlighted
    const suggestion = app.searchBox.suggestions.suggestion(testChannel.name);
    await expect(suggestion.locator).toHaveClass(/suggestion--selected/); // the list marks the selected row with this class only (no ARIA state)
    await expect(suggestion).toContainText(testChannel.display_name);
});
