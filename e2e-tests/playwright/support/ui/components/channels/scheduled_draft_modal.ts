// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator, Page} from '@playwright/test';

export default class ScheduledDraftModal {

    readonly container: Locator;

    readonly confirmButton;
    readonly dateInput;
    readonly timeLocator;
    readonly timeDropdownOptions;
    readonly dateLocator;

    constructor(container: Locator) {
        this.container = container;

        this.confirmButton = container.locator('button.confirm');
        this.dateInput = container.locator('div.Input_wrapper');
        this.timeLocator = container.locator('div.dateTime__input');
        this.timeDropdownOptions = container.locator('ul.dropdown-menu .MenuItem');
        this.dateLocator = (day: number, month: string) => container.locator(`button[aria-label*='${day}th ${month}']`);

    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectDay(){
        await this.dateInput.click();

        const pacificDate = this.getPacificDate();
        const day = pacificDate.getDate();
        const month = pacificDate.toLocaleString('default', { month: 'long' });

        await this.dateLocator(day, month).click()

    }

    async confirm() {
        await this.confirmButton.isVisible();
        await this.confirmButton.click();

    }

    async selectTime() {
        await this.timeLocator.click();
        // Construct the locator to select the time element by its position
        const timeButton = this.timeDropdownOptions.first();
        await expect(timeButton).toBeVisible();
        await timeButton.click();
    }

    getPacificDate(): Date {
        const currentDate = new Date();        
        // Convert the current date to Pacific Time
        const utcTime = currentDate.getTime() + (currentDate.getTimezoneOffset() * 60000);
        const pacificOffset = -7 * 60; // Pacific Daylight Time (UTC-07:00)
        const pacificTime = new Date(utcTime + (pacificOffset * 60000));
        
        return pacificTime;
    }
}

export {ScheduledDraftModal};
