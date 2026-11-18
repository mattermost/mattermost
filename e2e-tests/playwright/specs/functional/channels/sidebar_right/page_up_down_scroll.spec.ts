// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('should be able to scroll the RHS with page up and down', async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    await channelsPage.centerView.postCreate.postMessage('post');
    const lastPost = await channelsPage.getLastPost();
    await lastPost.reply();

    for (let i = 0; i < 10; i++) {
        await channelsPage.sidebarRight.postCreate.postMessage('a\n'.repeat(10));
    }

    const threadList = channelsPage.sidebarRight.threadList;
    const readScrollTop = () => threadList.evaluate((el) => el.scrollTop);
    let lastScrollTop = await readScrollTop();

    // The sample has to land while the browser is still scrolling. Waiting until the
    // list settles puts it on the top or bottom, so the next key cannot move it.
    const sampleAfter = async (direction: 'up' | 'down') => {
        await page.waitForTimeout(200);
        const current = await readScrollTop();
        if (direction === 'up') {
            expect(current).toBeLessThan(lastScrollTop);
        } else {
            expect(current).toBeGreaterThan(lastScrollTop);
        }
        lastScrollTop = current;
    };

    // # Press Page Up in the reply box. input.press focuses that box; pressing the
    // list would skip the path that moves focus from the textbox.
    await channelsPage.sidebarRight.postCreate.input.press('PageUp');

    // * Verify that the post list scrolled up by a page
    await sampleAfter('up');

    // # Press Page Up again, now with the thread list focused
    await page.keyboard.press('PageUp');

    // * Verify that the post list scrolled up another page
    await sampleAfter('up');

    // # Press Page Down with the thread list focused
    await page.keyboard.press('PageDown');

    // * Verify that the post list scrolled back down a page
    await sampleAfter('down');

    // # Press Page Down with the reply box focused
    await channelsPage.sidebarRight.postCreate.input.press('PageDown');

    // * Verify that the post list scrolled back toward the bottom
    await sampleAfter('down');
});
