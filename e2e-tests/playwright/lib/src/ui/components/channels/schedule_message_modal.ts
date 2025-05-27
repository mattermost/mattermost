// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class ScheduleMessageModal {
    readonly container: Locator;
    readonly dateButton: Locator;
    readonly timeButton: Locator;
    readonly timeOptionDropdown: Locator;
    readonly closeButton: Locator;
    readonly scheduleButton: Locator;
    readonly cancelButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.dateButton = container.locator('#customStatus__calendar-input');
        this.timeButton = container.getByTestId('time_button');
        this.timeOptionDropdown = container.getByLabel('Choose a time');
        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.scheduleButton = container.locator('button:has-text("Schedule")');
        this.cancelButton = container.locator('button:has-text("Cancel")');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getDaySuffix(day: number): string {
        if (day > 3 && day < 21) return 'th';

        switch (day % 10) {
            case 1:
                return 'st';
            case 2:
                return 'nd';
            case 3:
                return 'rd';
            default:
                return 'th';
        }
    }

    dateLocator(day: number, month: string, dayOfWeek: string) {
        const daySuffix = this.getDaySuffix(day);
        const name = `${day}${daySuffix} ${month} (${dayOfWeek})`;
        return this.container.getByRole('button', {name});
    }

    async selectDate(dayFromToday: number = 0) {
        await this.dateButton.click();

        const pacificDate = new Date();
        const originDate = new Date();

        if (dayFromToday) {
            pacificDate.setDate(pacificDate.getDate() + dayFromToday);
        }

        const day = pacificDate.getDate();
        const month = pacificDate.toLocaleString('default', {month: 'long'});
        const dayOfWeek = pacificDate.toLocaleDateString('en-US', {weekday: 'long'});

        const dateLocator = this.dateLocator(day, month, dayOfWeek);

        const isMonthChanged = pacificDate.getMonth() !== originDate.getMonth();
        if (!(await dateLocator.isVisible()) && isMonthChanged) {
            await this.container.getByLabel('Go to next month').click();
        }

        await dateLocator.click();

        // if day is single digit then prefix with a 0
        if (day < 10) {
            return `${month} 0${day}`;
        }

        return `${month} ${day}`;
    }

    async selectTime(optionIndex: number = 0) {
        await this.timeButton.click();
        const timeButton = this.timeOptionDropdown.getByTestId(`time_option_${optionIndex}-button`);
        await expect(timeButton).toBeVisible();
        await timeButton.click();

        return await timeButton.textContent();
    }

    async scheduleMessage(dayFromToday: number = 0, timeOptionIndex: number = 0) {
        await this.toBeVisible();

        const selectedDate = await this.selectDate(dayFromToday);
        const fromDateButton = await this.dateButton.inputValue();

        const selectedTime = await this.selectTime(timeOptionIndex);
        await this.scheduleButton.click();

        // if selectedDate is Today or Tomorrow then return Today or Tomorrow
        if (fromDateButton === 'Today' || fromDateButton === 'Tomorrow') {
            return {selectedDate: fromDateButton, selectedTime};
        }

        // if selectedDate is a date in the future then return the date
        return {selectedDate, selectedTime};
    }
}
