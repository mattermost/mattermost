// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type ChannelsPage, type PlaywrightExtended} from '@mattermost/playwright-lib';

const FIRST_DATE_EARLY = Date.UTC(2018, 5, 5, 9, 30);
const FIRST_DATE_LATER = Date.UTC(2018, 5, 5, 9, 45);
const SECOND_DATE_EARLY = Date.UTC(2018, 9, 15, 13, 15);
const SECOND_DATE_LATER = Date.UTC(2018, 9, 15, 13, 25);
const LATEST_DATE = Date.UTC(2019, 0, 16, 12);

export const searchFilterDates = {
    first: '2018-06-05',
    second: '2018-10-15',
    latest: '2019-01-16',
};

export async function setupSearchDateFilter(pw: PlaywrightExtended) {
    const {adminClient, team, user} = await pw.initSetup();
    const [anotherAdmin] = await adminClient.createUsers(team.id, 1, 'other-admin');
    const channel = await adminClient.createPublicChannel(team.id, 'Search Date Filter');
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
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

    await userClient.createPost({
        channel_id: channel.id,
        message: messages.latest,
        create_at: LATEST_DATE,
    });
    await anotherAdminClient.createPost({
        channel_id: channel.id,
        message: messages.first,
        create_at: FIRST_DATE_EARLY,
    });
    await userClient.createPost({
        channel_id: channel.id,
        message: messages.second,
        create_at: SECOND_DATE_EARLY,
    });
    await userClient.createPost({
        channel_id: offTopic.id,
        message: messages.firstOffTopic,
        create_at: FIRST_DATE_LATER,
    });
    await anotherAdminClient.createPost({
        channel_id: offTopic.id,
        message: messages.secondOffTopic,
        create_at: SECOND_DATE_LATER,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    return {
        channelsPage,
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

export async function searchAndValidate(channelsPage: ChannelsPage, query: string, expectedMessages: string[] = []) {
    await channelsPage.searchFor(query);

    const results = channelsPage.searchResultsPanel.getResultItems();
    await expect(results).toHaveCount(expectedMessages.length);

    if (expectedMessages.length === 0) {
        await expect(
            channelsPage.searchResultsPanel.container.getByText(`No results for “${query}”`, {exact: true}),
        ).toBeVisible();
        return;
    }

    for (const [index, message] of expectedMessages.entries()) {
        await expect(results.nth(index).getByText(message, {exact: true})).toBeVisible();
    }
}
