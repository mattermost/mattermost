// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class PostReminderMenu {
    readonly container: Locator;

    readonly thirtyMinsMenuItem;
    readonly oneHourMenuItem;
    readonly twoHoursMenuItem;
    readonly tomorrowMenuItem;
    readonly customMenuItem;

    constructor(container: Locator) {
        this.container = container;

        const getMenuItem = (hasText: string) => container.getByRole('menuitem').filter({hasText});

        this.thirtyMinsMenuItem = getMenuItem('30 mins');
        this.oneHourMenuItem = getMenuItem('1 hour');
        this.twoHoursMenuItem = getMenuItem('2 hours');
        this.tomorrowMenuItem = getMenuItem('Tomorrow');
        this.customMenuItem = getMenuItem('Custom');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

export {PostReminderMenu};
