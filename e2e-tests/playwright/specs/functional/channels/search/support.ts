// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {expect} from '@mattermost/playwright-lib';

export const searchContainerSelector = '#searchContainer';
export const popoutButtonSelector = '#searchContainer .PopoutButton';

/**
 * Opens the popout window by clicking the popout button inside the search container,
 * waits for DOM content to load, and returns the resulting popup page.
 */
export async function openPopoutFromSearchContainer(page: Page) {
    const popoutButton = page.locator(popoutButtonSelector);
    await expect(popoutButton).toBeVisible();

    const [popoutPage] = await Promise.all([page.waitForEvent('popup'), popoutButton.click()]);

    await popoutPage.waitForLoadState('domcontentloaded');
    return popoutPage;
}

/**
 * Asserts that the popout window URL contains the common popout-search path fragments.
 */
export function expectPopoutUrlContainsSearchPath(popoutUrl: string) {
    expect(popoutUrl).toContain('/_popout/rhs/');
    expect(popoutUrl).toContain('/search');
}
