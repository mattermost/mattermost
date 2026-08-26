// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Search box suggestion must be case insensitive', async ({pw}) => {
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    const searchWord = 'off';
    const searchOutput = 'In:off-topic';
    const channelName = 'Off-Topic';

    // Should work as expected when using lowercase
    // # Type in lowercase "off" to search for the "Off-Topic" channel
    const {searchInput} = channelsPage.searchBox;
    await searchInput.pressSequentially(`In:${searchWord}`);

    // * The suggestion should be visible
    await expect(channelsPage.searchBox.selectedSuggestion).toBeVisible();
    await expect(channelsPage.searchBox.selectedSuggestion).toHaveText(channelName);

    // # Press Enter to select the suggestion and another Enter to search
    await searchInput.press('Enter');
    await searchInput.press('Enter');

    // * The search box should contain the selected suggestion
    await expect(channelsPage.globalHeader.searchBox.getByText(searchOutput, {exact: true})).toBeVisible();

    // Should work as expected when using uppercase
    // # Open the search bar
    await channelsPage.globalHeader.openSearch();

    // # Clear its content
    await channelsPage.searchBox.clearIfPossible();

    // # Type in uppercase "OFF" to search for the "Off-Topic" channel
    await searchInput.type(`In:${searchWord.toUpperCase()}`);

    // * The suggestion should be visible
    await expect(channelsPage.searchBox.selectedSuggestion).toBeVisible();
    await expect(channelsPage.searchBox.selectedSuggestion).toHaveText(channelName);

    // # Press Enter to select the suggestion and another Enter to search
    await searchInput.press('Enter');
    await searchInput.press('Enter');

    // * The search box should contain the selected suggestion
    await expect(channelsPage.globalHeader.searchBox.getByText(searchOutput, {exact: true})).toBeVisible();
});

test('remove extra whitespace when selecting a user', async ({pw}) => {
    // # Set up test with two users
    const {user, adminUser: admin} = await pw.initSetup();

    // # Log in as the test user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the search UI
    await channelsPage.globalHeader.openSearch();

    // # Type "from:" followed by multiple spaces
    const {searchInput} = channelsPage.searchBox;
    await searchInput.pressSequentially(`from:    ${admin.username}`);

    // * The suggestion should be visible
    await expect(channelsPage.searchBox.selectedSuggestion).toBeVisible();
    await expect(channelsPage.searchBox.selectedSuggestion).toHaveText('@' + admin.username);

    // # Press enter to validate the selection
    await searchInput.press('Enter');

    // * Verify the search box shows "from:username" without extra spaces
    const expectedText = `from:${admin.username} `;
    await expect(searchInput).toHaveValue(expectedText);
});

/**
 * @objective Verify that grouped search suggestions are trimmed to ten results and retain the selected channel's
 * term/item pairing.
 */
test('limits grouped channel suggestions and preserves the selected channel', {tag: '@search'}, async ({pw}) => {
    const {team, user, adminClient} = await pw.initSetup();
    const prefix = `search-trim-${pw.random.id()}`;
    const channels = [];

    // The search endpoint returns up to 50 channels; the search UI trims the grouped results to 10.
    for (let i = 0; i < 12; i++) {
        const channel = await adminClient.createPublicChannel(team.id, `Search Trim ${i} ${prefix}`, `${prefix}-${i}`);
        await adminClient.addToChannel(user.id, channel.id);
        channels.push(channel);
    }

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();
    const {searchInput, container} = channelsPage.searchBox;
    await searchInput.fill(`In:${prefix}`);

    // * Verify trimResults applies across the grouped channel results
    const suggestions = container.getByRole('option');
    await expect(suggestions).toHaveCount(10);

    // # Select a result that survived trimming and verify the term/item pairing updates the query correctly
    const renderedText = (await suggestions.allInnerTexts()).join('\n');
    const selectedChannel = channels.find((channel) => renderedText.includes(channel.display_name));
    if (!selectedChannel) {
        throw new Error('Expected at least one created channel to remain in the trimmed suggestions');
    }
    await container.getByText(selectedChannel.display_name, {exact: true}).click();
    await expect(searchInput).toHaveValue(new RegExp(`In:${selectedChannel.name}\\s`));
});
