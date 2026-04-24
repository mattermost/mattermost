// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectPopoutUrlContainsSearchPath, openPopoutFromSearchContainer, searchContainerSelector} from './support';

test('MM-65630-2 Recent mentions popout should open with the right results', async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Mentions Popout Channel',
            name: 'mentions-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const mentionText = `hey @${user.username} check this mention-${pw.random.id()}`;
    await adminClient.createPost({
        channel_id: channel.id,
        message: mentionText,
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    await channelsPage.globalHeader.openRecentMentions();

    await expect(page.locator(searchContainerSelector)).toBeVisible();
    await expect(page.locator(searchContainerSelector).getByRole('heading', {name: 'Recent Mentions'})).toBeVisible();
    await expect(page.locator(searchContainerSelector).getByText(mentionText)).toBeVisible();

    const popoutPage = await openPopoutFromSearchContainer(page);
    const popoutUrl = popoutPage.url();
    expectPopoutUrlContainsSearchPath(popoutUrl);
    expect(popoutUrl).toContain('mode=mention');

    await expect(popoutPage.locator(searchContainerSelector)).toBeVisible({timeout: 10000});
    await expect(popoutPage.locator(searchContainerSelector).getByText(mentionText)).toBeVisible({timeout: 10000});

    await popoutPage.close();
});

test('MM-65630-3 Saved messages popout should open with the right results', async ({pw}) => {
    const {adminClient, user, userClient, team} = await pw.initSetup();

    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            displayName: 'Saved Popout Channel',
            name: 'saved-popout-channel',
        }),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const savedText = `saved-message-test-${pw.random.id()}`;
    const post = await adminClient.createPost({
        channel_id: channel.id,
        message: savedText,
    });

    await userClient.savePreferences(user.id, [
        {
            user_id: user.id,
            category: 'flagged_post',
            name: post.id,
            value: 'true',
        },
    ]);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    await channelsPage.globalHeader.savedMessagesButton.click();

    await expect(page.locator(searchContainerSelector)).toBeVisible();
    await expect(page.locator(searchContainerSelector).getByRole('heading', {name: 'Saved messages'})).toBeVisible();
    await expect(page.locator(searchContainerSelector).getByText(savedText)).toBeVisible();

    const popoutPage = await openPopoutFromSearchContainer(page);
    const popoutUrl = popoutPage.url();
    expectPopoutUrlContainsSearchPath(popoutUrl);
    expect(popoutUrl).toContain('mode=flag');

    await expect(popoutPage.locator(searchContainerSelector)).toBeVisible({timeout: 10000});
    await expect(popoutPage.locator(searchContainerSelector).getByText(savedText)).toBeVisible({timeout: 10000});

    await popoutPage.close();
});
