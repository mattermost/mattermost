// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

test('should be able to scroll the post list with page up and down', async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    for (let i = 0; i < 10; i++) {
        await channelsPage.centerView.postCreate.postMessage('a\n'.repeat(10));
    }

    let lastScrollTop = await getScrollTop(page, '#postListScrollContainer');

    // # Press the page up key with the post textbox focused
    channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageUp');

    // * Verify that the post list scrolled up by a page
    let currentScrollTop = await waitForSettledScrollTop(page, '#postListScrollContainer', lastScrollTop, 'up');
    expect(currentScrollTop).toBeLessThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page up key with the post list focused
    await page.keyboard.press('PageUp');

    // * Verify that the post list scrolled up another page
    currentScrollTop = await waitForSettledScrollTop(page, '#postListScrollContainer', lastScrollTop, 'up');
    expect(currentScrollTop).toBeLessThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page down key with the post list focused
    await page.keyboard.press('PageDown');

    // * Verify that the post list scrolled back down a page
    currentScrollTop = await waitForSettledScrollTop(page, '#postListScrollContainer', lastScrollTop, 'down');
    expect(currentScrollTop).toBeGreaterThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page down key with the post textbox focused
    channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageDown');

    // * Verify that the post list scrolled back to the bottom
    currentScrollTop = await waitForSettledScrollTop(page, '#postListScrollContainer', lastScrollTop, 'down');
    expect(currentScrollTop).toBeGreaterThan(lastScrollTop);
});

async function getScrollTop(page: Page, selector: string): Promise<number> {
    const locator = await page.locator(selector);
    return locator?.evaluate((element) => element.scrollTop);
}

// Page Up/Down can animate. Poll until scrollTop has moved and two samples match.
async function waitForSettledScrollTop(
    page: Page,
    selector: string,
    previous: number,
    direction: 'up' | 'down',
): Promise<number> {
    let current = previous;
    let lastSample = Number.NaN;

    await expect
        .poll(async () => {
            current = await getScrollTop(page, selector);
            const moved = direction === 'up' ? current < previous : current > previous;
            const settled = current === lastSample;
            lastSample = current;
            return moved && settled;
        })
        .toBe(true);

    return current;
}
