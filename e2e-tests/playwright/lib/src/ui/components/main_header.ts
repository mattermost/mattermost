// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class MainHeader extends BaseComponent {
    readonly logo;
    readonly backButton;

    constructor(container: Locator) {
        super(container);

        this.logo = container.getByTestId('headerLogoLink');
        this.backButton = container.getByTestId('back_button');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
