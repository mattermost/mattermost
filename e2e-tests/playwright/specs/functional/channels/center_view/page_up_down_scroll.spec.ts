// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('should be able to scroll the post list with page up and down', async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    for (let i = 0; i < 10; i++) {
        await channelsPage.centerView.postCreate.postMessage('a\n'.repeat(10));
    }

    const postList = page.locator('#postListScrollContainer');
    let lastScrollTop = await postList.evaluate((el) => el.scrollTop);

    // # Press the page up key with the post textbox focused
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageUp');

    // * Verify that the post list scrolled up by a page
    await expect.poll(() => postList.evaluate((el) => el.scrollTop)).toBeLessThan(lastScrollTop);
    lastScrollTop = await postList.evaluate((el) => el.scrollTop);

    // # Press the page up key with the post list focused
    await page.keyboard.press('PageUp');

    // * Verify that the post list scrolled up another page
    await expect.poll(() => postList.evaluate((el) => el.scrollTop)).toBeLessThan(lastScrollTop);
    lastScrollTop = await postList.evaluate((el) => el.scrollTop);

    // # Press the page down key with the post list focused
    await page.keyboard.press('PageDown');

    // * Verify that the post list scrolled back down a page
    await expect.poll(() => postList.evaluate((el) => el.scrollTop)).toBeGreaterThan(lastScrollTop);
    lastScrollTop = await postList.evaluate((el) => el.scrollTop);

    // # Press the page down key with the post textbox focused
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageDown');

    // * Verify that the post list scrolled back to the bottom
    await expect.poll(() => postList.evaluate((el) => el.scrollTop)).toBeGreaterThan(lastScrollTop);
});
