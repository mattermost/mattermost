// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const MINUTE = 60 * 1000;

// The day boundary below is UTC midnight, so keep the browser off the machine's timezone: on one
// ahead of UTC the posts the harness creates land on a different local day than the one under test.
test.use({timezoneId: 'UTC'});

/**
 * @objective Verify the date separators in an open channel relabel themselves when local midnight passes, without a reload.
 * @reference MM-60727
 */
test('MM-60727 relabels date separators when local midnight passes', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user, offTopic: channel} = await pw.initSetup();
    // The upcoming UTC midnight, so the posts the harness itself creates share a calendar day
    // with the one below and the client's clock never runs more than a day ahead of the server.
    const now = new Date();
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

    // The setup posts have to land on one side of that boundary, not straddle it.
    test.skip(midnight - now.getTime() < 5 * MINUTE, 'Skipping test - too close to a real UTC midnight');

    const eveningMessage = `evening ${pw.random.id()}`;
    const overnightMessage = `overnight ${pw.random.id()}`;

    // # Pin the user to UTC so the day boundary is the same one the clock is driven across
    await adminClient.patchUser({
        id: user.id,
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });

    // # Post a message half an hour before that midnight
    // only an admin can backdate a post (create_at), so the admin posts it
    const eveningPost = await adminClient.createPost({
        channel_id: channel.id,
        message: eveningMessage,
        create_at: midnight - 30 * MINUTE,
    });

    // # Open the channel with the client's clock set to the same evening
    const {app, page} = await pw.testBrowser.login(user);
    await page.clock.install({time: midnight - 10 * MINUTE});
    await app.channelsPage.goto({team, channel});
    await expect(app.center.postList.post(eveningPost).message.container).toHaveText(eveningMessage);

    // * Verify everything so far sits under a single separator reading "Today"
    const separators = app.center.postList.dateSeparator;
    await expect(separators).toHaveText(['Today']);

    // # Hold the clock ten seconds short of midnight
    await page.clock.pauseAt(new Date(midnight - 10 * 1000));

    // * Verify the separator still reads "Today"
    await expect(separators).toHaveText(['Today']);

    // # Let midnight pass without reloading the page, the way a suspended machine would
    await page.clock.fastForward(30 * 1000);

    // * Verify the separator relabels itself to "Yesterday"
    await expect(separators).toHaveText(['Yesterday']);

    // # Hand the page a live clock again, then add a post dated just after midnight
    await page.clock.resume();
    // only an admin can backdate a post (create_at), so the admin posts it
    const overnightPost = await adminClient.createPost({
        channel_id: channel.id,
        message: overnightMessage,
        create_at: midnight + 10 * 1000,
    });
    await expect(app.center.postList.post(overnightPost).message.container).toHaveText(overnightMessage);

    // * Verify the new post gets the only "Today" separator and the older one stays "Yesterday"
    await expect(separators).toHaveText(['Yesterday', 'Today']);
});
