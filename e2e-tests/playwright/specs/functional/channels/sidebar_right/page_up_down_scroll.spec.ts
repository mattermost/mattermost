// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';

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

    let lastScrollTop = await getScrollTop(page, '#threadViewerScrollContainer');

    // # Press the page up key with the post textbox focused
    channelsPage.sidebarRight.postCreate.input.focus();
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(200); // Wait for the browser's page up/down animation

    // * Verify that the post list scrolled up by a page
    let currentScrollTop = await getScrollTop(page, '#threadViewerScrollContainer');
    expect(currentScrollTop).toBeLessThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page up key with the post list focused
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled up another page
    currentScrollTop = await getScrollTop(page, '#threadViewerScrollContainer');
    expect(currentScrollTop).toBeLessThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page down key with the post list focused
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled back down a page
    currentScrollTop = await getScrollTop(page, '#threadViewerScrollContainer');
    expect(currentScrollTop).toBeGreaterThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page down key with the post textbox focused
    channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled back to the bottom
    currentScrollTop = await getScrollTop(page, '#threadViewerScrollContainer');
    expect(currentScrollTop).toBeGreaterThan(lastScrollTop);
});

async function getScrollTop(page: Page, selector: string): Promise<number> {
    const locator = await page.locator(selector);
    return locator?.evaluate((element) => element.scrollTop);
}
