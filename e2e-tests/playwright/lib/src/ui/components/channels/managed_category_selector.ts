// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ManagedCategorySelector {
    readonly container: Locator;
    readonly control: Locator;
    readonly clearButton: Locator;

    constructor(container: Locator) {
        this.container = container.getByTestId('managedCategorySelector');
        this.control = this.container.getByRole('combobox');
        this.clearButton = this.container.getByTestId('managedCategorySelectorClear');
    }

    get disabledControl() {
        return this.container.getByRole('combobox', {disabled: true});
    }

    get combobox() {
        return this.control;
    }

    async toBeVisible() {
        await expect(this.control).toBeVisible();
    }

    getCreateCategoryOption(page: Page, categoryName: string) {
        return page.getByRole('option', {name: `Create new category: ${categoryName}`});
    }
}
