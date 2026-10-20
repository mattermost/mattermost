// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Site Configuration -> Public Links
 */
export default class PublicLinks {
    readonly container: Locator;

    readonly maskedSalt: Locator;
    readonly regenerateButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        // Compass GeneratedSetting renders the masked salt as a disabled <input value>,
        // not as text content. Match the asterisk mask so regenerate makes this locator hide.
        this.maskedSalt = container.locator('input[value="********************************"]');
        this.regenerateButton = container.getByRole('button', {name: 'Regenerate'});
    }

    async toBeVisible() {
        await expect(this.regenerateButton).toBeVisible();
    }
}
