// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

test('should be able to scroll the post list with page up and down', async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    for (let i = 0; i < 10; i++) {
        await channelsPage.centerView.postCreate.postMessage('a\n'.repeat(10));
    }

    const initialScrollTop = await getScrollTop(page, '#postListScrollContainer');

    // # Press the page up key with the post textbox focused
    channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(200); // Wait for the browser's page up/down animation

    // * Verify that the post list scrolled up by a page
    const secondScrollTop = await getScrollTop(page, '#postListScrollContainer');
    expect(secondScrollTop).toBeLessThan(initialScrollTop);

    // # Press the page up key with the post list focused
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled up another page
    expect(await getScrollTop(page, '#postListScrollContainer')).toBeLessThan(secondScrollTop);

    // # Press the page down key with the post list focused
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled back down a page
    // Don't check for exact equality here due to occasional rounding errors
    expect((await getScrollTop(page, '#postListScrollContainer')) - secondScrollTop).toBeLessThan(1);

    // # Press the page down key with the post textbox focused
    channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled back to the bottom
    expect((await getScrollTop(page, '#postListScrollContainer')) - initialScrollTop).toBeLessThan(1);
});

async function getScrollTop(page: Page, selector: string): Promise<number> {
    const locator = await page.locator(selector);
    return locator?.evaluate((element) => element.scrollTop);
}
