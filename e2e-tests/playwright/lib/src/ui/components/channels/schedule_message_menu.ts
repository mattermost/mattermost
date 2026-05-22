// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ScheduleMessageMenu {
    readonly container: Locator;

    readonly tomorrowMenuItem;
    readonly mondayMenuItem;
    readonly nextMondayMenuItem;
    readonly theirMorningMenuItem;
    readonly recentlyUsedCustomTimeMenuItem;
    readonly customTimeMenuItem;
    readonly dmHeader;

    constructor(container: Locator) {
        this.container = container;

        this.tomorrowMenuItem = container.getByTestId('scheduling_time_tomorrow_9_am');
        this.mondayMenuItem = container.getByTestId('scheduling_time_monday_9_am');
        this.nextMondayMenuItem = container.getByTestId('scheduling_time_next_monday_9_am');
        this.theirMorningMenuItem = container.getByTestId('scheduling_time_their_morning');
        this.recentlyUsedCustomTimeMenuItem = container.getByTestId('recently_used_custom_time');
        this.customTimeMenuItem = container.getByText(/Choose a custom time/);
        this.dmHeader = container.getByText(/Schedule for/);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectCustomTime() {
        await this.customTimeMenuItem.click();
    }
}
