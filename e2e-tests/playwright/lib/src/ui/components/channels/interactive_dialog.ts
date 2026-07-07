// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class InteractiveDialog {
    readonly container: Locator;
    readonly page: Page;

    constructor(page: Page, container?: Locator) {
        this.page = page;
        this.container = container ?? page.getByRole('dialog');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getFieldByTestId(testId: string) {
        return this.container.getByTestId(testId);
    }

    getSelectControl(nthOrFieldTestId: 'first' | 'last' | string = 'first') {
        if (nthOrFieldTestId === 'first' || nthOrFieldTestId === 'last') {
            return nthOrFieldTestId === 'first'
                ? this.container.getByRole('combobox').first()
                : this.container.getByRole('combobox').last();
        }

        return this.container.getByTestId(nthOrFieldTestId).getByRole('combobox');
    }

    async selectOption(name: string) {
        await this.page.getByRole('option', {name}).click();
    }

    get datePickerButton() {
        return this.container.getByTestId('dateTimeDate').getByRole('button');
    }

    async selectDate(day: string) {
        await expect(this.page.getByRole('grid')).toBeVisible();
        await this.page.getByRole('grid').getByText(day, {exact: true}).click();
    }

    async selectTime(time: string) {
        await this.page.getByRole('menuitem', {name: time}).click();
    }
}
