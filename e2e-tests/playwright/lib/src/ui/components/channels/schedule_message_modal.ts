// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {getDayPickerDayCell} from '../day_picker';

export default class ScheduleMessageModal {
    readonly container: Locator;
    readonly dateButton: Locator;
    readonly timeButton: Locator;
    readonly timeOptionDropdown: Locator;
    readonly repeatWeeklyCheckbox: Locator;
    readonly closeButton: Locator;
    readonly scheduleButton: Locator;
    readonly cancelButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.dateButton = container.getByRole('button', {name: /Date/});
        this.timeButton = container.getByTestId('time_button');
        this.timeOptionDropdown = container.getByLabel('Choose a time');
        this.repeatWeeklyCheckbox = container.getByRole('checkbox', {name: 'Repeat weekly'});
        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.scheduleButton = container.getByRole('button', {name: 'Schedule'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    dateLocator(day: number) {
        return getDayPickerDayCell(this.container, day);
    }

    async selectDate(dayFromToday: number = 0) {
        await this.dateButton.click();

        const originDate = new Date();
        const targetDate = new Date();

        if (dayFromToday) {
            targetDate.setDate(targetDate.getDate() + dayFromToday);
        }

        const day = targetDate.getDate();
        const month = targetDate.toLocaleString('default', {month: 'long'});

        // Past days in the current month stay visible but disabled. When the
        // target is in the next month, day N of this month is still in the
        // calendar (e.g. Sep 1 when targeting Oct 1), so isVisible() is not
        // enough to decide whether to advance.
        if (targetDate.getMonth() !== originDate.getMonth() || targetDate.getFullYear() !== originDate.getFullYear()) {
            await this.container.getByLabel('Go to next month').click();
        }

        const dateLocator = this.dateLocator(day);
        await expect(dateLocator).toBeEnabled();
        await dateLocator.click();

        // Wait for the date-picker calendar to fully close before returning.
        const calendarPopper = this.container.getByTestId('date-picker-popper');
        await calendarPopper.waitFor({state: 'hidden'});

        // if day is single digit then prefix with a 0
        if (day < 10) {
            return `${month} 0${day}`;
        }

        return `${month} ${day}`;
    }

    async selectTime(optionIndex: number = 0) {
        await this.timeButton.click();
        const timeOption = this.container.page().getByTestId(`time_option_${optionIndex}`);
        // Use a generous timeout: the time-picker dropdown can be slow to render in CI.
        await expect(timeOption).toBeVisible({timeout: 30000});
        // Capture text BEFORE clicking — clicking closes the dropdown and detaches the
        // option element from the DOM, so textContent() would time out if called after.
        const text = await timeOption.textContent();
        await timeOption.click();

        return text;
    }

    async setRepeatWeekly(enabled: boolean) {
        const isChecked = await this.repeatWeeklyCheckbox.isChecked();

        if (isChecked !== enabled) {
            await this.repeatWeeklyCheckbox.click();
        }
    }

    async scheduleMessage(dayFromToday: number = 0, timeOptionIndex: number = 0, repeatWeekly?: boolean) {
        await this.toBeVisible();

        if (typeof repeatWeekly === 'boolean') {
            await this.setRepeatWeekly(repeatWeekly);
        }

        const selectedDate = await this.selectDate(dayFromToday);

        const fromDateButtonText = (await this.dateButton.textContent()) ?? '';

        const selectedTime = await this.selectTime(timeOptionIndex);
        await this.scheduleButton.click();

        // if selectedDate is Today or Tomorrow then return Today or Tomorrow
        if (fromDateButtonText.includes('Today')) {
            return {selectedDate: 'Today', selectedTime};
        }
        if (fromDateButtonText.includes('Tomorrow')) {
            return {selectedDate: 'Tomorrow', selectedTime};
        }

        // if selectedDate is a date in the future then return the date
        return {selectedDate, selectedTime};
    }
}
