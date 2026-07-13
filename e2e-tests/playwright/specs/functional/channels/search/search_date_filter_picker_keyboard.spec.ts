// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the "on:" search date filter can be set by clicking a day in the calendar picker,
 * and that the resulting date-filtered search returns the matching post.
 */
test('MM-T596 sets the search date with the calendar picker', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Pin the user's timezone and clock so "today" in the picker is a fixed, known date
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });
    const todayTimestamp = Date.UTC(2020, 5, 15, 12, 0);
    const todayFilter = toDateFilter(todayTimestamp);
    const message = `Calendar Picker ${pw.random.id()}`;
    await adminClient.createPost({
        channel_id: channel.id,
        user_id: user.id,
        message,
        create_at: todayTimestamp,
    });

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await page.clock.setFixedTime(todayTimestamp);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Type "on:" to open the day picker, then click today's date
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();
    await channelsPage.searchBox.searchInput.fill('on:');
    await channelsPage.searchBox.getDayPickerDay(15).click();

    // * Verify the search box auto-populates with the selected date in YYYY-MM-DD format
    await expect(channelsPage.searchBox.searchInput).toHaveValue(`on:${todayFilter} `);

    // # Complete the query with the message text and submit
    await channelsPage.searchBox.searchInput.press('End');
    await channelsPage.searchBox.searchInput.pressSequentially(message);
    await channelsPage.searchBox.searchInput.press('Enter');
    await expect(channelsPage.searchResultsContainer).toBeVisible();

    // * Verify the post created on that date is returned
    await expect(channelsPage.searchResultItems).toHaveCount(1);
    await expect(channelsPage.getSearchResultItem(message)).toBeVisible();
});

/**
 * @objective Verify editing the "on:" search date by keyboard changes which posts match: the original
 * date returns the post, and a later date does not.
 */
test('MM-T600 updates the search date with the keyboard', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');

    // # Pin the user's timezone and post a message on a known date
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });
    const postTimestamp = Date.UTC(2020, 5, 15, 12, 0);
    const postDateFilter = toDateFilter(postTimestamp);
    const laterDateFilter = toDateFilter(postTimestamp + 7 * 24 * 60 * 60 * 1000);
    const message = `Date ${pw.random.id()}`;
    await adminClient.createPost({
        channel_id: channel.id,
        user_id: user.id,
        message,
        create_at: postTimestamp,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Search for the message filtered to the date it was posted
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();
    await channelsPage.searchBox.searchInput.fill(`on:${postDateFilter} ${message}`);
    await channelsPage.searchBox.searchInput.press('Enter');
    await expect(channelsPage.searchResultsContainer).toBeVisible();

    // * Verify the post is returned for its own date
    await expect(channelsPage.searchResultItems).toHaveCount(1);
    await expect(channelsPage.getSearchResultItem(message)).toBeVisible();

    // # Reopen the search box and change the date filter to a week later, keeping the same message text
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();
    await channelsPage.searchBox.clearIfPossible();
    await channelsPage.searchBox.searchInput.fill(`on:${laterDateFilter} ${message}`);
    await channelsPage.searchBox.searchInput.press('Enter');

    // * Verify the post is no longer returned for the later date
    await expect(channelsPage.searchResultItems).toHaveCount(0);
});

function toDateFilter(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}
