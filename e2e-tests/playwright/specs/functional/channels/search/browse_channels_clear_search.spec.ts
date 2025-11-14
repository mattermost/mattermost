// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the Clear Search button appears only when a non-empty search term is entered in the Browse Channels modal
 */
test('clear search button appears only when search is active with non-empty term', {tag: '@browse_channels'}, async ({
    pw,
}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create test channels with unique names for search
    const timestamp = pw.random.id();
    const testChannelName = `test-channel-${timestamp}`;
    const testChannel = pw.random.channel({
        teamId: team.id,
        name: testChannelName,
        displayName: `Test Channel ${timestamp}`,
    });
    await adminClient.createChannel(testChannel);

    // # Log in a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open Browse Channels modal
    await channelsPage.sidebarLeft.findChannelButton.click();

    await channelsPage.findChannelsModal.toBeVisible();

    // * Verify clear search button is not visible initially
    const clearSearchButton = channelsPage.page.getByTestId('clear-search-button');
    await expect(clearSearchButton).not.toBeVisible();

    // # Type a search term
    await channelsPage.findChannelsModal.input.fill('test');

    // # Wait for search debounce (100ms)
    await channelsPage.page.waitForTimeout(150);

    // * Verify clear search button becomes visible
    await expect(clearSearchButton).toBeVisible();

    // # Clear the search input manually
    await channelsPage.findChannelsModal.input.fill('');

    // * Verify clear search button disappears when input is empty
    await expect(clearSearchButton).not.toBeVisible();

    // # Type search term again
    await channelsPage.findChannelsModal.input.fill('channel');

    // # Wait for search debounce
    await channelsPage.page.waitForTimeout(150);

    // * Verify clear search button is visible again
    await expect(clearSearchButton).toBeVisible();
});

/**
 * @objective Verify that clicking the Clear Search button clears the search and resets the view to default state
 */
test('clear search button clears search and resets view to default', {tag: '@browse_channels'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create multiple test channels
    const timestamp = pw.random.id();
    const channelPromises = [];
    for (let i = 0; i < 5; i++) {
        const channel = pw.random.channel({
            teamId: team.id,
            name: `searchable-channel-${timestamp}-${i}`,
            displayName: `Searchable Channel ${timestamp} ${i}`,
        });
        channelPromises.push(adminClient.createChannel(channel));
    }
    await Promise.all(channelPromises);

    // # Log in a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open Browse Channels modal
    await channelsPage.sidebarLeft.findChannelButton.click();
    await channelsPage.findChannelsModal.toBeVisible();

    // # Enter a search term
    const searchTerm = `searchable-channel-${timestamp}`;
    await channelsPage.findChannelsModal.input.fill(searchTerm);

    // # Wait for search debounce
    await channelsPage.page.waitForTimeout(150);

    // * Verify search input has the search term
    await expect(channelsPage.findChannelsModal.input).toHaveValue(searchTerm);

    // * Verify clear search button is visible
    const clearSearchButton = channelsPage.page.getByTestId('clear-search-button');
    await expect(clearSearchButton).toBeVisible();

    // * Verify search results are displayed
    const searchResults = channelsPage.findChannelsModal.searchList;
    await expect(searchResults.first()).toBeVisible();

    // # Click the clear search button
    await clearSearchButton.click();

    // * Verify search input is cleared
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');

    // * Verify clear search button is no longer visible
    await expect(clearSearchButton).not.toBeVisible();

    // * Verify view is reset to default channel list
    await expect(channelsPage.findChannelsModal.searchList.first()).toBeVisible();
});

/**
 * @objective Verify that the Clear Search button works correctly with different channel type filters (All, Public, Private)
 */
test('clear search button works with all channel type filters', {tag: '@browse_channels'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create public and private test channels
    const timestamp = pw.random.id();
    const publicChannel = pw.random.channel({
        teamId: team.id,
        name: `public-search-${timestamp}`,
        displayName: `Public Search ${timestamp}`,
        type: 'O',
    });
    await adminClient.createChannel(publicChannel);

    const privateChannel = pw.random.channel({
        teamId: team.id,
        name: `private-search-${timestamp}`,
        displayName: `Private Search ${timestamp}`,
        type: 'P',
    });
    const createdPrivateChannel = await adminClient.createChannel(privateChannel);

    // # Add user to the private channel
    await adminClient.addToChannel(user.id, createdPrivateChannel.id);

    // # Log in a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open Browse Channels modal
    await channelsPage.sidebarLeft.findChannelButton.click();
    await channelsPage.findChannelsModal.toBeVisible();

    // # Test with "All" filter (default)
    await channelsPage.findChannelsModal.input.fill('search');
    await channelsPage.page.waitForTimeout(150);

    const clearSearchButton = channelsPage.page.getByTestId('clear-search-button');
    await expect(clearSearchButton).toBeVisible();

    // # Clear search with All filter
    await clearSearchButton.click();
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');
    await expect(clearSearchButton).not.toBeVisible();

    // # Open filter dropdown
    const filterButton = channelsPage.page.locator('button[id^="channelsMoreDropdown"]').first();
    await filterButton.click();

    // # Select "Public" filter
    const publicFilterOption = channelsPage.page.getByRole('menuitem', {name: 'Public channels'});
    await publicFilterOption.click();

    // # Search again with Public filter
    await channelsPage.findChannelsModal.input.fill('public');
    await channelsPage.page.waitForTimeout(150);
    await expect(clearSearchButton).toBeVisible();

    // # Clear search with Public filter
    await clearSearchButton.click();
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');
    await expect(clearSearchButton).not.toBeVisible();

    // # Open filter dropdown again
    await filterButton.click();

    // # Select "Private" filter
    const privateFilterOption = channelsPage.page.getByRole('menuitem', {name: 'Private channels'});
    await privateFilterOption.click();

    // # Search with Private filter
    await channelsPage.findChannelsModal.input.fill('private');
    await channelsPage.page.waitForTimeout(150);
    await expect(clearSearchButton).toBeVisible();

    // # Clear search with Private filter
    await clearSearchButton.click();
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');
    await expect(clearSearchButton).not.toBeVisible();
});

/**
 * @objective Verify that the Clear Search button is keyboard accessible via Tab navigation and Enter key activation
 */
test('clear search button is accessible via keyboard navigation', {tag: '@browse_channels'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create test channel for search
    const timestamp = pw.random.id();
    const testChannel = pw.random.channel({
        teamId: team.id,
        name: `keyboard-test-${timestamp}`,
        displayName: `Keyboard Test ${timestamp}`,
    });
    await adminClient.createChannel(testChannel);

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open Browse Channels modal
    await channelsPage.sidebarLeft.findChannelButton.click();
    await channelsPage.findChannelsModal.toBeVisible();

    // # Enter a search term to make clear button visible
    await channelsPage.findChannelsModal.input.fill('keyboard');
    await page.waitForTimeout(150);

    const clearSearchButton = page.getByTestId('clear-search-button');
    await expect(clearSearchButton).toBeVisible();

    // # Focus the search input and tab to the clear button
    await channelsPage.findChannelsModal.input.focus();
    await expect(channelsPage.findChannelsModal.input).toBeFocused();

    // # Tab to the clear button
    await page.keyboard.press('Tab');

    // * Verify clear search button is focused
    await expect(clearSearchButton).toBeFocused();

    // # Activate the clear button with Enter key
    await page.keyboard.press('Enter');

    // * Verify search input is cleared
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');

    // * Verify clear button is no longer visible
    await expect(clearSearchButton).not.toBeVisible();

    // * Verify focus returns to the search input
    await expect(channelsPage.findChannelsModal.input).toBeFocused();
});

/**
 * @objective Verify that the Clear Search button can be activated with Space key for accessibility
 */
test('clear search button can be activated with Space key', {tag: '@browse_channels'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create test channel for search
    const timestamp = pw.random.id();
    const testChannel = pw.random.channel({
        teamId: team.id,
        name: `space-key-test-${timestamp}`,
        displayName: `Space Key Test ${timestamp}`,
    });
    await adminClient.createChannel(testChannel);

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open Browse Channels modal
    await channelsPage.sidebarLeft.findChannelButton.click();
    await channelsPage.findChannelsModal.toBeVisible();

    // # Enter a search term to make clear button visible
    await channelsPage.findChannelsModal.input.fill('space');
    await page.waitForTimeout(150);

    const clearSearchButton = page.getByTestId('clear-search-button');
    await expect(clearSearchButton).toBeVisible();

    // # Tab to the clear button
    await channelsPage.findChannelsModal.input.focus();
    await page.keyboard.press('Tab');

    // * Verify clear search button is focused
    await expect(clearSearchButton).toBeFocused();

    // # Activate the clear button with Space key
    await page.keyboard.press('Space');

    // * Verify search input is cleared
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');

    // * Verify clear button is no longer visible
    await expect(clearSearchButton).not.toBeVisible();
});

/**
 * @objective Verify that multiple consecutive searches and clears work correctly
 */
test('clear search button works correctly for multiple consecutive operations', {tag: '@browse_channels'}, async ({
    pw,
}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create test channels with different names
    const timestamp = pw.random.id();
    const channels = [
        {name: `alpha-channel-${timestamp}`, displayName: `Alpha Channel ${timestamp}`},
        {name: `beta-channel-${timestamp}`, displayName: `Beta Channel ${timestamp}`},
        {name: `gamma-channel-${timestamp}`, displayName: `Gamma Channel ${timestamp}`},
    ];

    for (const channelData of channels) {
        const channel = pw.random.channel({
            teamId: team.id,
            name: channelData.name,
            displayName: channelData.displayName,
        });
        await adminClient.createChannel(channel);
    }

    // # Log in a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open Browse Channels modal
    await channelsPage.sidebarLeft.findChannelButton.click();
    await channelsPage.findChannelsModal.toBeVisible();

    const clearSearchButton = channelsPage.page.getByTestId('clear-search-button');

    // # First search and clear cycle
    await channelsPage.findChannelsModal.input.fill('alpha');
    await channelsPage.page.waitForTimeout(150);
    await expect(clearSearchButton).toBeVisible();
    await clearSearchButton.click();
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');
    await expect(clearSearchButton).not.toBeVisible();

    // # Second search and clear cycle
    await channelsPage.findChannelsModal.input.fill('beta');
    await channelsPage.page.waitForTimeout(150);
    await expect(clearSearchButton).toBeVisible();
    await clearSearchButton.click();
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');
    await expect(clearSearchButton).not.toBeVisible();

    // # Third search and clear cycle
    await channelsPage.findChannelsModal.input.fill('gamma');
    await channelsPage.page.waitForTimeout(150);
    await expect(clearSearchButton).toBeVisible();
    await clearSearchButton.click();
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');
    await expect(clearSearchButton).not.toBeVisible();

    // * Verify modal is still functional after multiple operations
    await channelsPage.findChannelsModal.input.fill('channel');
    await channelsPage.page.waitForTimeout(150);
    await expect(clearSearchButton).toBeVisible();
});
