// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import {duration} from '@/util';

/**
 * System Console Navbar component
 */
export default class SystemConsoleNavbar extends BaseComponent {
    readonly backLink: Locator;

    constructor(container: Locator) {
        super(container);
        this.backLink = container.getByTestId('backstageNavbarBack');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible({timeout: duration.half_min});
        await expect(this.backLink).toBeVisible({timeout: duration.half_min});
    }

    /**
     * Click the back link to return to the team
     */
    async clickBack() {
        await this.backLink.click();
    }
}
