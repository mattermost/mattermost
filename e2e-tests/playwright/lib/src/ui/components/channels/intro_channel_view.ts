// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class IntroChannelView extends BaseComponent {
    readonly addPeopleButton: Locator;
    readonly setHeaderButton: Locator;
    readonly sendMessageInput: Locator;

    constructor(container: Locator) {
        super(container);
        this.addPeopleButton = container.getByTestId('intro-channel-header-buttons--add-people');
        this.setHeaderButton = container.getByTestId('intro-channel-header-buttons--set-header');
        this.sendMessageInput = container.getByTestId('post_textbox');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
