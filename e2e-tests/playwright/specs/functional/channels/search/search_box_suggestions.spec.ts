// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Search box suggestion must be case insensitive', async ({pw}) => {
    const {user, team, offTopic, townSquare} = await pw.initSetup();
    // # Log in a user in new browser context and visit a default channel page
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    const searchWord = 'off';
    const searchOutput = `In:${offTopic.name}`;
    const input = app.searchBox.inputSearchbox;
    const suggestion = app.searchBox.suggestions.suggestion(offTopic.name);

    for (const typed of [searchWord, searchWord.toUpperCase()]) {
        // # Open the search box, clear it, and type the channel filter (lowercase, then uppercase)
        await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
        await input.fill('');
        await input.type(`In:${typed}`);

        // * The suggestion should be visible and highlighted
        await expect(suggestion.locator).toHaveClass(/suggestion--selected/); // the list marks the selected row with this class only (no ARIA state)
        await expect(suggestion).toBeVisible();
        await expect(suggestion).toContainText(offTopic.display_name);

        // # Press Enter to select the suggestion and another Enter to search
        await input.press('Enter', 'Enter');

        // * The search bar should contain the selected suggestion
        await expect(app.globalHeader.search.openButton).toContainText(searchOutput);
    }
});

test('remove extra whitespace when selecting a user', async ({pw}) => {
    // # Set up test with two users
    const {user, adminUser: admin, team, townSquare} = await pw.initSetup();
    // # Log in as the test user and visit a default channel page
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open the search UI and type "from:" followed by multiple spaces
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    const input = app.searchBox.inputSearchbox;
    await input.type(`from:    ${admin.username}`);

    // * The suggestion should be visible and highlighted
    const suggestion = app.searchBox.suggestions.suggestion(admin.username);
    await expect(suggestion.locator).toHaveClass(/suggestion--selected/); // the list marks the selected row with this class only (no ARIA state)
    await expect(suggestion).toBeVisible();
    await expect(suggestion).toContainText('@' + admin.username);

    // # Press enter to validate the selection
    await input.press('Enter');

    // * Verify the search box shows "from:username" without extra spaces
    await expect(input).toHaveValue(`from:${admin.username} `);
});

/**
 * @objective Verify that grouped search suggestions are trimmed to ten results and retain the selected channel's
 * term/item pairing.
 */
test('limits grouped channel suggestions and preserves the selected channel', {tag: '@search'}, async ({pw}) => {
    const {team, user, adminClient, townSquare} = await pw.initSetup();
    const prefix = `search-trim-${pw.random.id()}`;
    const channels = [];

    // The search endpoint returns up to 50 channels; the search UI trims the grouped results to 10.
    for (let i = 0; i < 12; i++) {
        const channel = await adminClient.createPublicChannel(team.id, `Search Trim ${i} ${prefix}`, `${prefix}-${i}`);
        await adminClient.addToChannel(user.id, channel.id);
        channels.push(channel);
    }
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    const input = app.searchBox.inputSearchbox;
    await input.fill(`In:${prefix}`);

    // * Verify trimResults applies across the grouped channel results
    const {suggestions} = app.searchBox;
    await expect(suggestions.suggestionList).toHaveKeyCount(10);

    // # Select a result that survived trimming and verify the term/item pairing updates the query correctly
    const keys = await suggestions.suggestionList.keys();
    const selectedChannel = channels.find((channel) => keys.includes(channel.name));
    if (!selectedChannel) {
        throw new Error('Expected at least one created channel to remain in the trimmed suggestions');
    }
    await suggestions.suggestion(selectedChannel.name).select();
    await expect(input).toHaveValue(new RegExp(`In:${selectedChannel.name}\\s`));
});
