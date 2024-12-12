// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class UserProfilePopover {
    readonly container: Locator;

    readonly username;
    readonly email;

    constructor(container: Locator) {
        this.container = container;

        this.username = container.locator('#userPopoverUsername');
        this.email = container.locator('.user-profile-popover__email');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.container.getByLabel('Close user profile popover').click();
    }

    getFullName(username: string) {
        return this.container.getByTestId(`popover-fullname-${username}`);
    }
}

export {UserProfilePopover};
