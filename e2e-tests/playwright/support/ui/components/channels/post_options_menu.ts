// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class PostOptionsMenu {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async click(option: string | RegExp, exact = false) {
        const optionLocator = this.container.getByText(option, {exact});
        await optionLocator.waitFor();

        await optionLocator.click();
    }
}

export {PostOptionsMenu};
