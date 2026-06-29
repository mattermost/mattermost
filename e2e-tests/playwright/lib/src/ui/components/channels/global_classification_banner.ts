// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class GlobalClassificationBanner {
    readonly container: Locator;
    readonly bannerTop: Locator;
    readonly bannerBottom: Locator;

    constructor(page: ReturnType<Locator['page']>) {
        this.container = page.locator('[data-testid^="global-classification-banner"]').first();
        this.bannerTop = page.getByTestId('global-classification-banner-top');
        this.bannerBottom = page.getByTestId('global-classification-banner-bottom');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.bannerTop.or(this.bannerBottom)).toBeVisible();
    }
}
