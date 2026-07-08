// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * Server-rendered page shown when the desktop app version is below the server minimum.
 */
export default class UnsupportedDesktopAppPage {
    readonly page: Page;
    readonly heading: Locator;
    readonly message: Locator;
    readonly downloadLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole('heading', {name: 'Update Required'});
        this.message = page.getByTestId('unsupportedDesktopAppMessage');
        this.downloadLink = page.getByRole('link', {name: 'Download Updated App'});
    }

    async toBeVisible() {
        await expect(this.heading).toBeVisible();
        await expect(this.message).toBeVisible();
        await expect(this.downloadLink).toBeVisible();
    }

    async goto() {
        await this.page.goto('/');
    }
}
