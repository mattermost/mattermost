// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * System Console -> About -> Edition and License
 */
export default class EditionAndLicense {
    readonly container: Locator;
    readonly header: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.header = container.getByText('Edition and License', {exact: true});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }
}
