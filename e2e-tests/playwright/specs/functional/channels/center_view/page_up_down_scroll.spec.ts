// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Page Up and Page Down scroll the center post list.
 */
test('should be able to scroll the post list with page up and down', async ({pw}) => {
    const {user, team, userClient, townSquare: channel} = await pw.initSetup();
    // # Fill the channel with tall posts so the list can scroll
    for (let i = 0; i < 10; i++) {
        await userClient.createPost({channel_id: channel.id, message: `post ${i}\n` + 'a\n'.repeat(10)});
    }

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const input = app.center.postCreate.message.container;
    const scroller = app.center.postList.scroller.locator;
    const scrollTop = () => scroller.evaluate((element) => element.scrollTop);

    // Page Up/Down scroll smoothly: wait for the position to stop changing before reading it
    const settledScrollTop = async () => {
        let previous = -1;
        await expect
            .poll(async () => {
                const current = await scrollTop();
                const settled = current === previous;
                previous = current;
                return settled;
            })
            .toBe(true);
        return previous;
    };

    // (the list scrolls to the newest post once its rows are measured)
    await expect.poll(scrollTop).toBeGreaterThan(0);
    let last = await settledScrollTop();

    // # Press Page Up from the message box
    // * Verify the list scrolls up
    await input.focus();
    await input.press('PageUp');
    await expect.poll(scrollTop).toBeLessThan(last);
    last = await settledScrollTop();

    // # Press Page Up again
    // * Verify the list scrolls further up
    await input.press('PageUp');
    await expect.poll(scrollTop).toBeLessThan(last);
    last = await settledScrollTop();

    // # Press Page Down
    // * Verify the list scrolls down
    await input.press('PageDown');
    await expect.poll(scrollTop).toBeGreaterThan(last);
    last = await settledScrollTop();

    // # Focus the message box again and press Page Down
    // * Verify the list scrolls further down
    await input.focus();
    await input.press('PageDown');
    await expect.poll(scrollTop).toBeGreaterThan(last);
});
