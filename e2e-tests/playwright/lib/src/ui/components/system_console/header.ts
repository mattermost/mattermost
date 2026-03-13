// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * System Console section header component
 * Represents the header area that displays the current section title
 */
export default class SystemConsoleHeader {
    readonly container: Locator;
    readonly title: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.title = container.locator('.admin-console__header');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getTitle(): Promise<string> {
        return (await this.title.textContent()) ?? '';
    }

    async toHaveTitle(expectedTitle: string) {
        await expect(this.title).toContainText(expectedTitle);
    }
}
