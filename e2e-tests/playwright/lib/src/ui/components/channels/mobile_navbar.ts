// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The channel header shown in narrow/mobile view (`#navbar`), distinct from the desktop
 * `#global-header` — the two are mutually exclusive based on viewport width.
 */
export default class ChannelsMobileNavbar {
    readonly container: Locator;

    readonly searchButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.searchButton = container.getByRole('button', {name: 'Search', exact: true});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async openSearch() {
        await this.searchButton.click();
    }
}
