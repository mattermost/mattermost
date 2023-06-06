// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ChannelsSidebarLeft {
    readonly container: Locator;
    readonly findChannelButton;

    constructor(container: Locator) {
        this.container = container;

        this.findChannelButton = container.getByRole('button', {name: 'Find Channels'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

export {ChannelsSidebarLeft};
