// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const MINUTE = 60 * 1000;

/**
 * @objective Verify the date separators in an open channel relabel themselves when local midnight passes, without a reload.
 * @reference MM-60727
 */
test('MM-60727 relabels date separators when local midnight passes', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');

    // The upcoming UTC midnight, so the posts the harness itself creates share a calendar day
    // with the one below and the client's clock never runs more than a day ahead of the server.
    const now = new Date();
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

    const eveningMessage = `evening ${pw.random.id()}`;
    const overnightMessage = `overnight ${pw.random.id()}`;

    // # Pin the user to UTC so the day boundary is the same one the clock is driven across
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });

    // # Post a message half an hour before that midnight
    await adminClient.createPost({
        channel_id: channel.id,
        user_id: user.id,
        message: eveningMessage,
        create_at: midnight - 30 * MINUTE,
    });

    // # Open the channel with the client's clock set to the same evening
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await page.clock.install({time: midnight - 10 * MINUTE});
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.container.getByText(eveningMessage, {exact: true})).toBeVisible();

    // * Verify everything so far sits under a single separator reading "Today"
    const separators = channelsPage.centerView.container.getByTestId('basicSeparator');
    await expect(separators).toHaveText(['Today']);

    // # Hold the clock ten seconds short of midnight
    await page.clock.pauseAt(new Date(midnight - 10 * 1000));

    // * Verify the separator still reads "Today"
    await expect(separators).toHaveText(['Today']);

    // # Let midnight pass without reloading the page
    await page.clock.fastForward('00:30');

    // * Verify the separator relabels itself to "Yesterday"
    await expect(separators).toHaveText(['Yesterday']);

    // # Add a post dated just after midnight
    await adminClient.createPost({
        channel_id: channel.id,
        user_id: user.id,
        message: overnightMessage,
        create_at: midnight + 30 * 1000,
    });
    await expect(channelsPage.centerView.container.getByText(overnightMessage, {exact: true})).toBeVisible();

    // * Verify the new post gets the only "Today" separator and the older one stays "Yesterday"
    await expect(separators).toHaveText(['Yesterday', 'Today']);
});
