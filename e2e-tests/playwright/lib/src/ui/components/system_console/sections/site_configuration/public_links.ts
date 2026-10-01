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
        this.maskedSalt = container.getByText('********************************');
        this.regenerateButton = container.getByRole('button', {name: 'Regenerate'});
    }

    async toBeVisible() {
        await expect(this.regenerateButton).toBeVisible();
    }
}
