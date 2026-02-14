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

    let lastScrollTop = await getScrollTop(page, '#postListScrollContainer');

    // # Press the page up key with the post textbox focused
    channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(200); // Wait for the browser's page up/down animation

    // * Verify that the post list scrolled up by a page
    let currentScrollTop = await getScrollTop(page, '#postListScrollContainer');
    expect(currentScrollTop).toBeLessThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page up key with the post list focused
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled up another page
    currentScrollTop = await getScrollTop(page, '#postListScrollContainer');
    expect(currentScrollTop).toBeLessThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page down key with the post list focused
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled back down a page
    currentScrollTop = await getScrollTop(page, '#postListScrollContainer');
    expect(currentScrollTop).toBeGreaterThan(lastScrollTop);
    lastScrollTop = currentScrollTop;

    // # Press the page down key with the post textbox focused
    channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);

    // * Verify that the post list scrolled back to the bottom
    currentScrollTop = await getScrollTop(page, '#postListScrollContainer');
    expect(currentScrollTop).toBeGreaterThan(lastScrollTop);
});

test('should be able to scroll textinput with pageup/pagedown when overflow', async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Fill the input with multiple long lines
    const multiLineMessage = Array.from({length: 30}, () => 'This is a long line for scroll testing.').join('\n');
    await channelsPage.centerView.postCreate.input.fill(multiLineMessage);

    // # Focus the input and scroll to the bottom
    const input = channelsPage.centerView.postCreate.input;
    await input.focus();
    await input.evaluate((el: HTMLTextAreaElement) => {
        el.scrollTop = el.scrollHeight;
    });

    // # Save initial scroll positions
    const inputScrollBefore = await input.evaluate((el: HTMLTextAreaElement) => el.scrollTop);

    // # Press PageUp in the input
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(200);

    // * Expect input to scroll up
    const inputScrollAfterUp = await input.evaluate((el: HTMLTextAreaElement) => el.scrollTop);
    expect(inputScrollAfterUp).toBeLessThan(inputScrollBefore);

    // # Press PageDown in the input
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);

    // * Expect input to scroll back down
    const inputScrollAfterDown = await input.evaluate((el: HTMLTextAreaElement) => el.scrollTop);
    expect(inputScrollAfterDown).toBeGreaterThan(inputScrollAfterUp);
});


async function getScrollTop(page: Page, selector: string): Promise<number> {
    const locator = await page.locator(selector);
    return locator?.evaluate((element) => element.scrollTop);
}
