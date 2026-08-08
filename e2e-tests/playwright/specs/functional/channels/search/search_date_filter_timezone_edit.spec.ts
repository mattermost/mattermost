// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectNoSearchResult, expectSearchResult, submitSearch} from './search_result_helpers';

/**
 * @objective Verify changing timezone changes which posts match an on: date filter.
 */
test('MM-T595 Changing timezone changes day search results appears', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const identifier = `timezone-${pw.random.id()}`;
    const targetMessage = `targetAM ${identifier}`;
    const targetTimestamp = Date.UTC(2018, 9, 31, 23, 59);

    // # Create a post close to a day boundary and search in UTC
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });
    await adminClient.createPost({
        channel_id: channel.id,
        user_id: user.id,
        message: targetMessage,
        create_at: targetTimestamp,
    });
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const utcQuery = `on:2018-10-31 ${identifier}`;
    await submitSearch(channelsPage, utcQuery);

    // * Verify the result appears for the UTC date
    await expectSearchResult(channelsPage, targetMessage, utcQuery);

    // # Change timezone and run the same date-filtered search
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'Europe/Brussels', useAutomaticTimezone: 'false'},
    });
    await channelsPage.page.reload();
    await submitSearch(channelsPage, utcQuery);

    // * Verify the post no longer matches the previous day in the new timezone
    await expectNoSearchResult(channelsPage, targetMessage);
});

/**
 * @objective Verify editing a date-filtered search query, via the interactive day picker, updates the search results.
 */
test('MM-T599 Edit date and search again', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const targetMessage = `calendarUpdate-${pw.random.id()}`;
    const targetTimestamp = Date.UTC(2019, 0, 15, 9, 30);

    // # Create a dated post and pin the client's clock to that date, so "today" in the day picker is Jan 15, 2019
    await adminClient.createPost({
        channel_id: channel.id,
        user_id: user.id,
        message: targetMessage,
        create_at: targetTimestamp,
    });
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await page.clock.setFixedTime(targetTimestamp);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Type "on:" to open the day picker and click today's date
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();
    await channelsPage.searchBox.searchInput.fill('on:');
    await channelsPage.searchBox.getDayPickerDay(15).click();

    // * Verify the search box auto-populates with the selected date
    await expect(channelsPage.searchBox.searchInput).toHaveValue('on:2019-01-15 ');

    // # Complete and submit the query
    await channelsPage.searchBox.searchInput.press('End');
    await channelsPage.searchBox.searchInput.pressSequentially(targetMessage);
    await channelsPage.searchBox.searchInput.press('Enter');
    await expect(channelsPage.searchResultsContainer).toBeVisible();

    // * Verify exactly one matching result for the original date
    await expect(channelsPage.searchResultItems).toHaveCount(1);
    await expect(channelsPage.getSearchResultItem(targetMessage)).toBeVisible();

    // # Reopen the channel, then reopen the day picker by backspacing right after the date
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();
    const originalDateQuery = `on:2019-01-15 ${targetMessage}`;
    await channelsPage.searchBox.searchInput.fill(originalDateQuery);
    for (let i = 0; i < targetMessage.length + 1; i++) {
        await channelsPage.searchBox.searchInput.press('ArrowLeft');
    }
    await channelsPage.searchBox.searchInput.press('Backspace');

    // # Click the day after the pinned date
    await channelsPage.searchBox.getDayPickerDay(16).click();

    // * Verify the search box updates to the edited date, then submit
    await expect(channelsPage.searchBox.searchInput).toHaveValue(`on:2019-01-16 ${targetMessage}`);
    await channelsPage.searchBox.searchInput.press('Enter');

    // * Verify the original post is not returned for the edited date
    await expect(channelsPage.searchResultItems).toHaveCount(0);
});

/**
 * @objective Verify an on: date filter includes posts at both boundaries of the selected day and excludes adjacent days.
 */
test('MM-T604 Use "on:" to return only results from the selected day', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const identifier = `date-boundary-${pw.random.id()}`;
    const posts = [
        {message: `before ${identifier}`, create_at: Date.UTC(2018, 11, 24, 23, 59)},
        {message: `target AM ${identifier}`, create_at: Date.UTC(2018, 11, 25, 0, 0)},
        {message: `target PM ${identifier}`, create_at: Date.UTC(2018, 11, 25, 23, 59, 59, 999)},
        {message: `after ${identifier}`, create_at: Date.UTC(2018, 11, 26, 0, 0)},
    ];

    // # Create posts immediately before, at both ends of, and immediately after the selected day
    for (const post of posts) {
        await adminClient.createPost({
            channel_id: channel.id,
            user_id: user.id,
            message: post.message,
            create_at: post.create_at,
        });
    }

    // # Search for the unique identifier on the selected date
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    await submitSearch(channelsPage, `on:2018-12-25 ${identifier}`);

    // * Verify only the two posts created on the selected day are returned
    await expect(channelsPage.searchResultItems).toHaveCount(2);
    await expect(channelsPage.getSearchResultItem(`target AM ${identifier}`)).toBeVisible();
    await expect(channelsPage.getSearchResultItem(`target PM ${identifier}`)).toBeVisible();
    await expectNoSearchResult(channelsPage, `before ${identifier}`);
    await expectNoSearchResult(channelsPage, `after ${identifier}`);
});
