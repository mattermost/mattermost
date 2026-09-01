// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The "Leave the team?" confirmation dialog, shown from the team menu's Leave team action.
 */
export default class LeaveTeamModal {
    readonly container: Locator;

    readonly yesButton;

    constructor(container: Locator) {
        this.container = container;

        this.yesButton = container.getByRole('button', {name: 'Yes'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async confirm() {
        await this.yesButton.click();
    }
}
