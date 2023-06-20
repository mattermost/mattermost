// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ChannelsAppBar {
    readonly container: Locator;

    readonly playbooksIcon;

    constructor(container: Locator) {
        this.container = container;

        this.playbooksIcon = container.locator('#app-bar-icon-playbooks').getByRole('img');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

export {ChannelsAppBar};
