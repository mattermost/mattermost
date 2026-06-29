// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class ChannelsAppBar extends BaseComponent {
    readonly playbooksIcon;

    constructor(container: Locator) {
        super(container);

        this.playbooksIcon = container.locator('#app-bar-icon-playbooks').getByRole('img');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
