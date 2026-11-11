// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

async function scrollTopAfterMove(read: () => Promise<number>, previous: number, direction: 'up' | 'down') {
    let observed = previous;
    await expect
        .poll(async () => {
            observed = await read();
            return direction === 'up' ? observed < previous : observed > previous;
        })
        .toBe(true);
    return observed;
}

test('should be able to scroll the post list with page up and down', async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    for (let i = 0; i < 10; i++) {
        await channelsPage.centerView.postCreate.postMessage('a\n'.repeat(10));
    }

    const postList = page.locator('#postListScrollContainer');
    const readScrollTop = () => postList.evaluate((el) => el.scrollTop);
    let lastScrollTop = await readScrollTop();

    // # Press the page up key with the post textbox focused.
    // The editor moves focus to the post list; send the key again so the list actually scrolls.
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageUp');
    await postList.focus();
    await page.keyboard.press('PageUp');

    // * Verify that the post list scrolled up by a page
    lastScrollTop = await scrollTopAfterMove(readScrollTop, lastScrollTop, 'up');

    // # Press the page up key with the post list focused
    await page.keyboard.press('PageUp');

    // * Verify that the post list scrolled up another page
    lastScrollTop = await scrollTopAfterMove(readScrollTop, lastScrollTop, 'up');

    // # Press the page down key with the post list focused
    await page.keyboard.press('PageDown');

    // * Verify that the post list scrolled back down a page
    lastScrollTop = await scrollTopAfterMove(readScrollTop, lastScrollTop, 'down');

    // # Press the page down key with the post textbox focused
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageDown');
    await postList.focus();
    await page.keyboard.press('PageDown');

    // * Verify that the post list scrolled back toward the bottom
    await scrollTopAfterMove(readScrollTop, lastScrollTop, 'down');
});
