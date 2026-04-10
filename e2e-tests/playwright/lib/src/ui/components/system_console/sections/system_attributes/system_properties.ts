// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

const USER_ATTRIBUTES_URL = '/admin_console/system_attributes/user_attributes';

/**
 * System Console -> System Attributes -> User Attributes
 *
 * Page object for the Custom Profile Attributes (CPA) field-definition UI.
 * Covers the attribute table, type selectors, dot-menu actions, and save flow.
 */
export default class SystemProperties {
    readonly container: Locator;
    private readonly page;

    readonly addAttributeButton: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        this.container = container.getByTestId('systemProperties');
        this.page = container.page();

        this.addAttributeButton = this.container.getByRole('button', {name: 'Add attribute'});
        this.saveButton = this.page.getByTestId('saveSetting');
    }

    // ── Visibility ──────────────────────────────────────────────────────

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async goto() {
        await this.page.goto(USER_ATTRIBUTES_URL);
        await this.page.waitForLoadState('networkidle');
    }

    // ── Attribute row accessors ─────────────────────────────────────────

    nameInput(nth: number): Locator {
        return this.container.getByTestId('property-field-input').nth(nth);
    }

    /**
     * Value-based locator — appropriate only for read-only assertions on
     * pre-populated inputs (never as an action target after fill()).
     */
    nameInputByValue(value: string): Locator {
        return this.container.locator(`input[value="${value}"]`);
    }

    typeSelector(nth: number): Locator {
        return this.container.getByTestId('fieldTypeSelectorMenuButton').nth(nth);
    }

    /**
     * react-select generates dynamic IDs with no stable role or test-id;
     * this is the only reliable selector for the options input.
     */
    valuesInput(nth: number): Locator {
        return this.container.locator('input[id^="react-select-"]').nth(nth);
    }

    // ── Attribute actions ───────────────────────────────────────────────

    async addAttribute() {
        await this.addAttributeButton.click();
    }

    async selectType(nth: number, typeName: string) {
        await this.typeSelector(nth).click();
        await this.page.getByRole('menuitemradio', {name: typeName, exact: true}).click();
    }

    async addOption(nth: number, value: string) {
        const input = this.valuesInput(nth);
        await input.fill(value);
        await input.press('Enter');
    }

    async addOptions(nth: number, values: string[]) {
        for (const value of values) {
            await this.addOption(nth, value);
        }
    }

    // ── Save ────────────────────────────────────────────────────────────

    /**
     * Click Save and wait for the server round-trip to complete.
     *
     * Monitors the actual /api/v4/custom_profile_attributes/fields network
     * requests rather than relying on the coarse `networkidle` heuristic,
     * then asserts the button returns to disabled (no pending changes).
     */
    async saveAndWaitForSettled() {
        await expect(this.saveButton).toBeEnabled();

        const saveResponsePromise = this.page.waitForResponse(
            (resp: {url: () => string; status: () => number}) =>
                resp.url().includes('/api/v4/custom_profile_attributes/fields') && resp.status() < 400,
        );

        await this.saveButton.click();
        await saveResponsePromise;
        await expect(this.saveButton).toBeDisabled({timeout: 10000});
    }

    // ── Dot-menu ────────────────────────────────────────────────────────

    dotMenuButton(fieldId: string): Locator {
        return this.container.getByTestId(`user-property-field_dotmenu-${fieldId}`);
    }

    dotMenuButtonForUnsaved(): Locator {
        return this.container.getByTestId(/user-property-field_dotmenu-/).last();
    }

    async openDotMenu(fieldId: string) {
        await this.dotMenuButton(fieldId).click();
    }

    async openDotMenuForUnsaved() {
        await this.dotMenuButtonForUnsaved().click();
    }

    async deleteAttribute() {
        await this.page.getByRole('menuitem', {name: 'Delete attribute'}).click();
    }

    async confirmDeletion() {
        await this.page.getByRole('button', {name: 'Delete'}).click();
    }

    async duplicateAttribute() {
        await this.page.getByRole('menuitem', {name: 'Duplicate attribute'}).click();
    }

    async setVisibility(option: string) {
        await this.page.getByRole('menuitem', {name: /Visibility/}).hover();
        const radioOption = this.page.getByRole('menuitemradio', {name: option});
        await expect(radioOption).toBeAttached();
        await radioOption.click({force: true});
    }

    async toggleEditableByUsers() {
        await this.page.getByRole('menuitemcheckbox', {name: 'Editable by users'}).click();
    }

    async dismissMenu() {
        await this.page.keyboard.press('Escape');
    }

    // ── Validation ──────────────────────────────────────────────────────

    validationMessage(text: string): Locator {
        return this.container.getByText(text);
    }
}
