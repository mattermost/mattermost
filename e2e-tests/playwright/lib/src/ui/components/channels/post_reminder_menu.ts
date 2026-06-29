// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class PostReminderMenu extends BaseComponent {
    readonly thirtyMinsMenuItem;
    readonly oneHourMenuItem;
    readonly twoHoursMenuItem;
    readonly tomorrowMenuItem;
    readonly customMenuItem;

    constructor(container: Locator) {
        super(container);

        this.thirtyMinsMenuItem = container.getByRole('menuitem', {
            name: en['post_info.post_reminder.sub_menu.thirty_minutes'],
        });
        this.oneHourMenuItem = container.getByRole('menuitem', {name: en['post_info.post_reminder.sub_menu.one_hour']});
        this.twoHoursMenuItem = container.getByRole('menuitem', {
            name: en['post_info.post_reminder.sub_menu.two_hours'],
        });
        this.tomorrowMenuItem = container.getByRole('menuitem', {
            name: en['post_info.post_reminder.sub_menu.tomorrow'],
        });
        this.customMenuItem = container.getByRole('menuitem', {name: en['post_info.post_reminder.sub_menu.custom']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
