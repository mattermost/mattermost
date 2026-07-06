// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ScheduleMessageMenu {
    readonly container: Locator;

    readonly todayMenuItem;
    readonly tomorrowMenuItem;
    readonly mondayMenuItem;
    readonly nextMondayMenuItem;
    readonly recentlyUsedCustomTimeMenuItem;
    readonly customTimeMenuItem;
    readonly recipientTimezoneCheckbox;

    constructor(container: Locator) {
        this.container = container;

        this.todayMenuItem = container.getByTestId('scheduling_time_today_9_am');
        this.tomorrowMenuItem = container.getByTestId('scheduling_time_tomorrow_9_am');
        this.mondayMenuItem = container.getByTestId('scheduling_time_monday_9_am');
        this.nextMondayMenuItem = container.getByTestId('scheduling_time_next_monday_9_am');
        this.recentlyUsedCustomTimeMenuItem = container.getByTestId('recently_used_custom_time');
        this.customTimeMenuItem = container.getByText(/Choose a custom time/);
        this.recipientTimezoneCheckbox = container.getByRole('checkbox', {name: /Use recipient's timezone/});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectCustomTime() {
        await this.customTimeMenuItem.click();
    }
}
