// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Page Up and Page Down scroll an open thread in the RHS.
 */
test('should be able to scroll the RHS with page up and down', async ({pw}) => {
    const {user, team, userClient, townSquare: channel} = await pw.initSetup();
    // # Create a thread with tall replies so it can scroll
    const root = await userClient.createPost({channel_id: channel.id, message: 'post'});
    for (let i = 0; i < 10; i++) {
        await userClient.createPost({
            channel_id: channel.id,
            root_id: root.id,
            message: `reply ${i}\n` + 'a\n'.repeat(10),
        });
    }

    // # Open the thread in the RHS
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const rootPost = app.center.postList.post(root);
    await rootPost.locator.hover();
    await rootPost.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
    await expect.poll(async () => (await app.rhs.thread.postList.keys()).length).toBe(11);

    const input = app.rhs.postCreate.message.container.locator;
    const scroller = app.rhs.thread.scroller.locator;
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

    // (the thread opens scrolled to its newest reply)
    await expect.poll(scrollTop).toBeGreaterThan(0);
    let last = await settledScrollTop();

    // # Press Page Up with the RHS textbox focused
    // * Verify the thread scrolls up by a page
    await input.focus();
    await input.press('PageUp');
    await expect.poll(scrollTop).toBeLessThan(last);
    last = await settledScrollTop();

    // # Press Page Up again
    // * Verify the thread scrolls up another page
    await input.press('PageUp');
    await expect.poll(scrollTop).toBeLessThan(last);
    last = await settledScrollTop();

    // # Press Page Down
    // * Verify the thread scrolls back down a page
    await input.press('PageDown');
    await expect.poll(scrollTop).toBeGreaterThan(last);
    last = await settledScrollTop();

    // # Focus the RHS textbox again and press Page Down
    // * Verify the thread scrolls back toward the bottom
    await input.focus();
    await input.press('PageDown');
    await expect.poll(scrollTop).toBeGreaterThan(last);
});
