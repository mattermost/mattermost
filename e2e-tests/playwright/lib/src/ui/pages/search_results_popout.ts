// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';

/**
 * Page object for the search results popout window.
 * This is a separate browser window opened when clicking the popout search button.
 */
export default class SearchResultsPopout {
    readonly page: Page;

    readonly searchContainer: Locator;
    readonly popoutButton: Locator;
    readonly closeButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.searchContainer = page.locator('#searchContainer');
        this.popoutButton = page.getByRole('button', {name: en['new_window_button.tooltip']});
        this.closeButton = page.locator('#searchResultsCloseButton');
    }

    getSearchResultByText(text: string): Locator {
        return this.searchContainer.getByText(text);
    }

    async toBeVisible(): Promise<void> {
        await expect(this.searchContainer).toBeVisible();
    }
}
