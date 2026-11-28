// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App} from '@mattermost/playwright-lib';

import {pickerDay} from './search_date_filter_helpers';

/** Opens the search box empty. */
async function openEmptySearch(app: App) {
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill('');
    await expect(app.searchBox.inputSearchbox).toHaveValue('');
    return app.searchBox.inputSearchbox;
}

/**
 * @objective Verify the "on:" search date filter can be set by clicking a day in the calendar picker,
 * and that the resulting date-filtered search returns the matching post.
 */
test('MM-T596 sets the search date with the calendar picker', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user, townSquare: channel} = await pw.initSetup();
    // # Pin the user's timezone and clock so "today" in the picker is a fixed, known date
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });
    const todayTimestamp = Date.UTC(2020, 5, 15, 12, 0);
    const todayFilter = toDateFilter(todayTimestamp);
    const message = `Calendar Picker ${pw.random.id()}`;

    // only an admin can backdate a post (create_at), so the admin posts it
    const post = await adminClient.createPost({
        channel_id: channel.id,
        message,
        create_at: todayTimestamp,
    });

    const {app, page} = await pw.testBrowser.login(user);
    await page.clock.setFixedTime(todayTimestamp);
    await app.channelsPage.goto({team, channel});

    // # Type "on:" to open the day picker, then click today's date
    const input = await openEmptySearch(app);
    await input.fill('on:');
    await pickerDay(app, 15).click();

    // * Verify the search box auto-populates with the selected date in YYYY-MM-DD format
    await expect(input).toHaveValue(`on:${todayFilter} `);

    // # Complete the query with the message text and submit
    await input.press('End');
    // The caret must be after the completed filter before the message is appended.
    await expect
        .poll(() =>
            input.locator.evaluate((element: HTMLInputElement) => element.selectionStart === element.value.length),
        )
        .toBe(true);
    await input.type(message);
    await input.press('Enter');

    // * Verify the post created on that date is returned
    await expect(app.search.results.postList).toHaveKeys([post.id]);
});

/**
 * @objective Verify editing the "on:" search date by keyboard changes which posts match: the original
 * date returns the post, and a later date does not.
 */
test('MM-T600 updates the search date with the keyboard', {tag: '@search'}, async ({pw}) => {
    const {adminClient, team, user, offTopic: channel} = await pw.initSetup();
    // # Pin the user's timezone and post a message on a known date
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });
    const postTimestamp = Date.UTC(2020, 5, 15, 12, 0);
    const postDateFilter = toDateFilter(postTimestamp);
    const laterDateFilter = toDateFilter(postTimestamp + 7 * 24 * 60 * 60 * 1000);
    const message = `Date ${pw.random.id()}`;

    // only an admin can backdate a post (create_at), so the admin posts it
    const post = await adminClient.createPost({
        channel_id: channel.id,
        message,
        create_at: postTimestamp,
    });

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Search for the message filtered to the date it was posted
    let input = await openEmptySearch(app);
    await input.fill(`on:${postDateFilter} ${message}`);
    await input.press('Enter');

    // * Verify the post is returned for its own date
    await expect(app.search.results.postList).toHaveKeys([post.id]);

    // # Reopen the search box and change the date filter to a week later, keeping the same message text
    input = await openEmptySearch(app);
    await input.fill(`on:${laterDateFilter} ${message}`);
    await input.press('Enter');

    // * Verify the post is no longer returned for the later date
    await expect(app.noResults.titleText).toBeVisible();
    await expect(app.search.results.postList).toHaveKeyCount(0);
});

/**
 * @objective Verify that pressing Backspace after a completed date filter reopens the calendar day picker.
 */
test('MM-T3997 reopens the date picker when backspacing after a date filter', {tag: '@search'}, async ({pw}) => {
    const {user, team, townSquare} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open search and type a "before:" date filter to open the day picker
    const input = await openEmptySearch(app);
    await input.fill('before:');
    const day15 = pickerDay(app, 15);
    await expect(day15).toBeVisible();

    // # Select a day from the picker
    await day15.click();

    // * Verify the date is added to the query and the picker closes
    await expect(input).toHaveValue(/before:\d{4}-\d{2}-\d{2} /);
    await expect(day15).not.toBeVisible();

    // # Backspace into the completed date filter so the date becomes partial again
    await input.focus();
    await input.press('End', 'Backspace', 'Backspace');

    // * Verify the search input now holds a partial date and the day picker reappears
    await expect(input).toHaveValue(/before:\d{4}-\d{2}-1$/);
    await expect(day15).toBeVisible();
});

function toDateFilter(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}
