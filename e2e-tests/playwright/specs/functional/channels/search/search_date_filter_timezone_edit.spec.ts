// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {duration, expect, test, type App} from '@mattermost/playwright-lib';

import {pickerDay} from './search_date_filter_helpers';

/**
 * @objective Verify changing timezone changes which posts match an on: date filter.
 */
test('MM-T595 Changing timezone changes day search results appears', async ({pw}) => {
    const {adminClient, team, user, offTopic: channel} = await pw.initSetup();
    const identifier = `timezone-${pw.random.id()}`;
    const targetMessage = `targetAM ${identifier}`;
    const targetTimestamp = Date.UTC(2018, 9, 31, 23, 59);

    // # Create a post close to a day boundary and search in UTC
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });

    // only an admin can backdate a post (create_at), so the admin posts it
    const post = await adminClient.createPost({
        channel_id: channel.id,
        message: targetMessage,
        create_at: targetTimestamp,
    });

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    const utcQuery = `on:2018-10-31 ${identifier}`;
    await submitSearch(app, utcQuery);

    // * Verify the result appears for the UTC date
    await expectSearchResult(app, post, utcQuery);

    // # Change timezone and run the same date-filtered search
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'Europe/Brussels', useAutomaticTimezone: 'false'},
    });
    await page.reload();
    await submitSearch(app, utcQuery);

    // * Verify the post no longer matches the previous day in the new timezone
    await expect(app.noResults.titleText).toBeVisible();
    await expect(app.search.results.post(post)).toHaveCount(0);
});

/**
 * @objective Verify editing a date-filtered search query, via the interactive day picker, updates the search results.
 */
test('MM-T599 Edit date and search again', async ({pw}) => {
    const {adminClient, team, user, offTopic: channel} = await pw.initSetup();
    const targetMessage = `calendarUpdate-${pw.random.id()}`;
    const targetTimestamp = Date.UTC(2019, 0, 15, 9, 30);

    // # Create a dated post and pin the client's clock to that date, so "today" in the day picker is Jan 15, 2019
    // only an admin can backdate a post (create_at), so the admin posts it
    const post = await adminClient.createPost({
        channel_id: channel.id,
        message: targetMessage,
        create_at: targetTimestamp,
    });

    const {app, page} = await pw.testBrowser.login(user);
    await page.clock.setFixedTime(targetTimestamp);
    await app.channelsPage.goto({team, channel});
    const input = app.searchBox.inputSearchbox;

    // # Type "on:" to open the day picker and click today's date
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await input.fill('on:');
    await pickerDay(app, 15).click();

    // * Verify the search box auto-populates with the selected date
    await expect(input).toHaveValue('on:2019-01-15 ');

    // # Complete and submit the query
    await input.press('End');
    // The caret must be after the completed filter before the message is appended.
    await expect
        .poll(() =>
            input.locator.evaluate((element: HTMLInputElement) => element.selectionStart === element.value.length),
        )
        .toBe(true);
    await input.type(targetMessage);
    await input.press('Enter');

    // * Verify exactly one matching result for the original date
    await expect(app.search.results.postList).toHaveKeys([post.id]);

    // # Reopen the channel, then reopen the day picker by backspacing right after the date
    await app.channelsPage.goto({team, channel});
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await input.fill(`on:2019-01-15 ${targetMessage}`);
    await input.press('ArrowLeft', ...Array<string>(targetMessage.length).fill('ArrowLeft'), 'Backspace');
    await expect(pickerDay(app, 16)).toBeVisible();

    // # Click the day after the pinned date
    await pickerDay(app, 16).click();

    // * Verify the search box updates to the edited date, then submit
    await expect(input).toHaveValue(`on:2019-01-16 ${targetMessage}`);
    await input.press('Enter');

    // * Verify the original post is not returned for the edited date
    await expect(app.noResults.titleText).toBeVisible();
    await expect(app.search.results.postList).toHaveKeyCount(0);
});

async function submitSearch(app: App, query: string) {
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(query);
    await app.searchBox.inputSearchbox.press('Enter');
    await expect(app.globalHeader.search.openButton).toContainText(query);
}

/** The post shows in the results; the search is retried while the server indexes it. */
async function expectSearchResult(app: App, post: Post, query: string, timeout = duration.half_min) {
    const result = app.search.results.post(post).locator;
    await expect(async () => {
        await submitSearch(app, query);
        await expect(result).toBeVisible({timeout: duration.one_sec * 5});
    }).toPass({timeout});
}
