// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console -> About -> Edition and License
 */
export default class EditionAndLicense extends BaseComponent {
    readonly header: Locator;

    constructor(container: Locator) {
        super(container);
        this.header = container.getByText(en['admin.license.title'], {exact: true});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }
}
