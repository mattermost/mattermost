// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class ThreadFooter extends BaseComponent {
    readonly replyButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.replyButton = container.getByTestId('replyButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Clicks on the reply button in the thread footer to open the thread in RHS.
     */
    async reply() {
        await this.replyButton.waitFor();
        await this.replyButton.click();
    }
}
