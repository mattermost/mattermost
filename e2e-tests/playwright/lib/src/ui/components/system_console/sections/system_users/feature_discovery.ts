// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

/**
 * System Console -> Feature Discovery
 */
export default class FeatureDiscovery {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toHaveTitle(title: string) {
        await expect(this.container.getByTestId('featureDiscovery_title')).toHaveText(title);
    }
}
