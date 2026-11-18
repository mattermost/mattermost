// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, monthDays, type App, type PlaywrightExtended} from '@mattermost/playwright-lib';

const FIRST_DATE_EARLY = Date.UTC(2018, 5, 5, 9, 30);
const FIRST_DATE_LATER = Date.UTC(2018, 5, 5, 9, 45);
const SECOND_DATE_EARLY = Date.UTC(2018, 9, 15, 13, 15);
const SECOND_DATE_LATER = Date.UTC(2018, 9, 15, 13, 25);
const LATEST_DATE = Date.UTC(2019, 0, 16, 12);

const toISODate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const searchFilterDates = {
    first: toISODate(FIRST_DATE_EARLY),
    second: toISODate(SECOND_DATE_EARLY),
    latest: toISODate(LATEST_DATE),
};

export async function setupSearchDateFilter(pw: PlaywrightExtended) {
    const {adminClient, team, user, offTopic} = await pw.initSetup();
    const [anotherAdmin] = await adminClient.createUsers(team.id, 1, 'other-admin');
    const channel = await adminClient.createPublicChannel(team.id, 'Search Date Filter');
    await adminClient.addToChannel(user.id, channel.id);
    await adminClient.addToChannel(anotherAdmin.id, channel.id);
    await adminClient.updateUserRoles(user.id, 'system_user system_admin');
    await adminClient.updateUserRoles(anotherAdmin.id, 'system_user system_admin');
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });
    const {client: userClient} = await pw.makeClient(user);
    const {client: anotherAdminClient} = await pw.makeClient(anotherAdmin);

    const commonText = pw.random.id();
    const messages = {
        latest: `1st Today's message ${commonText}`,
        first: `5th First message ${commonText}`,
        second: `3rd Second message ${commonText}`,
        firstOffTopic: `4th Off topic 1 ${commonText}`,
        secondOffTopic: `2nd Off topic 2 ${commonText}`,
    };
    const postIds: Record<string, string> = {};

    postIds[messages.latest] = (
        await userClient.createPost({
            channel_id: channel.id,
            message: messages.latest,
            create_at: LATEST_DATE,
        })
    ).id;
    postIds[messages.first] = (
        await anotherAdminClient.createPost({
            channel_id: channel.id,
            message: messages.first,
            create_at: FIRST_DATE_EARLY,
        })
    ).id;
    postIds[messages.second] = (
        await userClient.createPost({
            channel_id: channel.id,
            message: messages.second,
            create_at: SECOND_DATE_EARLY,
        })
    ).id;
    postIds[messages.firstOffTopic] = (
        await userClient.createPost({
            channel_id: offTopic.id,
            message: messages.firstOffTopic,
            create_at: FIRST_DATE_LATER,
        })
    ).id;
    postIds[messages.secondOffTopic] = (
        await anotherAdminClient.createPost({
            channel_id: offTopic.id,
            message: messages.secondOffTopic,
            create_at: SECOND_DATE_LATER,
        })
    ).id;

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    return {
        search: {app, postId: (message: string) => postIds[message]} as DateFilterSearch,
        channel,
        anotherAdmin,
        commonText,
        messages,
        allMessagesInOrder: [
            messages.latest,
            messages.secondOffTopic,
            messages.second,
            messages.firstOffTopic,
            messages.first,
        ],
    };
}

/** The logged-in app and each fixture post's id by its message. */
export type DateFilterSearch = {app: App; postId: (message: string) => string};

/** Searches, then checks the results are exactly the expected posts, in order (by post id). */
export async function searchAndValidate(search: DateFilterSearch, query: string, expectedMessages: string[] = []) {
    const {app} = search;
    const input = app.searchBox.inputSearchbox;
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await input.fill(query);
    await input.press('Enter');

    if (expectedMessages.length === 0) {
        await expect(app.noResults.titleText).toHaveText(`No results for “${query}”`);
        await expect(app.search.results.postList).toHaveKeyCount(0);
        return;
    }

    await expect(app.search.results.postList).toHaveKeys(expectedMessages.map(search.postId));
}

/**
 * The search date picker's day in the month it shows. The picker and its days declare no parts, so the day is found by
 * the picker's id and the library's own markup.
 */
export function pickerDay(app: App, dayOfMonth: number) {
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- react-day-picker's root takes an id, not a test id; its days have no parts
    return monthDays(app.page.locator('#searchDatePicker')).getByText(String(dayOfMonth), {exact: true});
}
