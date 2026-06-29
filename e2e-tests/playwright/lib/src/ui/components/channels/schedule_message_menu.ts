// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class ScheduleMessageMenu extends BaseComponent {
    readonly tomorrowMenuItem;
    readonly mondayMenuItem;
    readonly nextMondayMenuItem;
    readonly recentlyUsedCustomTimeMenuItem;
    readonly customTimeMenuItem;

    constructor(container: Locator) {
        super(container);

        this.tomorrowMenuItem = container.getByTestId('scheduling_time_tomorrow_9_am');
        this.mondayMenuItem = container.getByTestId('scheduling_time_monday_9_am');
        this.nextMondayMenuItem = container.getByTestId('scheduling_time_next_monday_9_am');
        this.recentlyUsedCustomTimeMenuItem = container.getByTestId('recently_used_custom_time');
        this.customTimeMenuItem = container.getByText(
            en['create_post_button.option.schedule_message.options.choose_custom_time'],
        );
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectCustomTime() {
        await this.customTimeMenuItem.click();
    }
}
