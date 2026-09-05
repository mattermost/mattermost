// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test, type ChannelsPage} from '@mattermost/playwright-lib';

/**
 * @objective Verify message search displays matching results in the right-hand side, rendering markdown
 * content correctly, and that jumping to the conversation and clearing the query keep results intact.
 */
test('MM-T350 Searching displays results in the RHS', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const identifier = pw.random.id();
    const message = [
        `Basic word search: Hello world! #hello ${identifier}`,
        '',
        '##### Hello',
        '',
        '```',
        'Hello',
        '```',
    ].join('\n');

    // # Create and search for a message with markdown content: a heading, a code block, and a hashtag
    await adminClient.createPost({channel_id: channel.id, user_id: user.id, message});
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const query = `hello ${identifier}`;
    await submitSearch(channelsPage, query);

    // * Verify the matching result appears in the RHS with each markdown element rendered distinctly
    await expectSearchResult(channelsPage, 'Hello world', query);
    const result = channelsPage.getSearchResultItem('Hello world');
    await expect(result.locator('h5.markdown__heading')).toContainText('Hello');
    await expect(result.locator('.post-code.post-code--wrap code')).toContainText('Hello');
    await expect(result).toContainText('#hello');

    // # Jump to the conversation from the search result
    await result.getByRole('link', {name: 'Jump'}).click();

    // # Reopen search and clear the query text
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();

    // * Verify the search results remain visible after clearing the query text
    await expect(channelsPage.searchResultsContainer).toBeVisible();
});

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

async function submitSearch(channelsPage: ChannelsPage, query: string) {
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();
    await channelsPage.searchBox.searchInput.fill(query);
    await channelsPage.searchBox.searchInput.press('Enter');
    await expect(channelsPage.searchResultsContainer).toBeVisible();
}

async function expectSearchResult(
    channelsPage: ChannelsPage,
    text: string,
    query?: string,
    timeout = duration.half_min,
) {
    const result = channelsPage.getSearchResultItem(text);

    await expect(async () => {
        if (await result.isVisible({timeout: duration.one_sec}).catch(() => false)) {
            return;
        }

        if (query) {
            await submitSearch(channelsPage, query);
        } else {
            await channelsPage.searchBox.searchInput.press('Enter');
        }
        await expect(result).toBeVisible({timeout: duration.one_sec * 5});
    }).toPass({timeout});
}

async function expectNoSearchResult(channelsPage: ChannelsPage, text: string) {
    await expect(channelsPage.getSearchResultItem(text)).toHaveCount(0);
}
