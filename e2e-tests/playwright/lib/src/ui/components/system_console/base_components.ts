// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * Radio Setting - represents a true/false radio button group
 * Uses getByRole for radio buttons, getByText for help text
 *
 * Usage:
 *   await setting.selectTrue();
 *   await setting.toBeTrue();
 *   await setting.toBeFalse();
 */
export class RadioSetting {
    readonly container: Locator;
    readonly trueOption: Locator;
    readonly falseOption: Locator;
    readonly helpText: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.trueOption = container.getByRole('radio', {name: 'True'});
        this.falseOption = container.getByRole('radio', {name: 'False'});
        this.helpText = container.locator('.help-text');
    }

    /**
     * Select the True option
     */
    async selectTrue() {
        await this.trueOption.check();
    }

    /**
     * Select the False option
     */
    async selectFalse() {
        await this.falseOption.check();
    }

    /**
     * Assert that the setting is visible
     */
    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Assert that the True option is selected
     */
    async toBeTrue() {
        await expect(this.trueOption).toBeChecked();
    }

    /**
     * Assert that the False option is selected (True is not checked)
     */
    async toBeFalse() {
        await expect(this.falseOption).toBeChecked();
    }
}

/**
 * Text Input Setting - represents a text input field
 */
export class TextInputSetting {
    readonly container: Locator;
    readonly label: Locator;
    readonly input: Locator;
    readonly helpText: Locator;

    constructor(container: Locator, labelText: string) {
        this.container = container;
        this.label = container.getByText(labelText);
        this.input = container.getByRole('textbox');
        this.helpText = container.locator('.help-text');
    }

    async fill(value: string) {
        await this.input.fill(value);
    }

    async getValue(): Promise<string> {
        return (await this.input.inputValue()) ?? '';
    }

    async clear() {
        await this.input.clear();
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

/**
 * Dropdown Setting - represents a select dropdown
 */
export class DropdownSetting {
    readonly container: Locator;
    readonly label: Locator;
    readonly dropdown: Locator;
    readonly helpText: Locator;

    constructor(container: Locator, labelText: string) {
        this.container = container;
        this.label = container.getByText(labelText);
        this.dropdown = container.getByRole('combobox');
        this.helpText = container.locator('.help-text');
    }

    async select(option: string) {
        await this.dropdown.selectOption(option);
    }

    async getSelectedValue(): Promise<string> {
        return (await this.dropdown.inputValue()) ?? '';
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

/**
 * Admin Section Panel - represents a collapsible section panel
 */
export class AdminSectionPanel {
    readonly container: Locator;
    readonly title: Locator;
    readonly description: Locator;
    readonly body: Locator;

    constructor(container: Locator, titleText: string) {
        this.container = container;
        this.title = container.getByRole('heading', {name: titleText});
        this.description = container.locator('.AdminSectionPanel__description');
        this.body = container.locator('.AdminSectionPanel__body');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
