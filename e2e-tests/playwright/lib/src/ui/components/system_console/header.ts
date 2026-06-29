// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

/**
 * System Console section header component
 * Represents the header area that displays the current section title
 */
export default class SystemConsoleHeader extends BaseComponent {
    readonly title: Locator;

    constructor(container: Locator) {
        super(container);
        this.title = container.getByTestId('adminConsoleHeader');
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
