// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

const BOARD_ATTRIBUTES_URL = '/admin_console/system_attributes/board_attributes';

/**
 * System Console -> System Attributes -> Board Attributes
 *
 * Page object for the Boards property-field admin UI. Covers the locked
 * (seeded) Status and Assignee rows, the add-attribute flow, the dot menu,
 * and the save flow.
 */
export default class BoardAttributes {
    readonly container: Locator;
    private readonly page;

    readonly addAttributeButton: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        this.container = container.getByTestId('boardAttributes');
        this.page = container.page();

        this.addAttributeButton = this.container.getByRole('button', {name: 'Add attribute'});
        this.saveButton = this.page.getByTestId('saveSetting');
    }

    // ── Visibility ──────────────────────────────────────────────────────

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async goto() {
        await this.page.goto(BOARD_ATTRIBUTES_URL);
        await this.page.waitForLoadState('networkidle');
    }

    // ── Row accessors ───────────────────────────────────────────────────

    /** Name input for a given attribute row (nth, zero-indexed). */
    nameInput(nth: number): Locator {
        return this.container.getByTestId('board-attribute-field-input').nth(nth);
    }

    /** Read-only locator by visible name. */
    nameInputByValue(value: string): Locator {
        return this.container.locator(`input[value="${value}"]`);
    }

    /** Last (most recently added) name input — stable when concurrent tests add rows. */
    lastNameInput(): Locator {
        return this.container.getByTestId('board-attribute-field-input').last();
    }

    /** Type selector trigger for an attribute row (nth, zero-indexed). */
    typeSelector(nth: number): Locator {
        return this.container.getByTestId('fieldTypeSelectorMenuButton').nth(nth);
    }

    /** Dot menu trigger by field id (the {testid-prefix}-{fieldId} pattern). */
    dotMenu(fieldId: string): Locator {
        return this.container.getByTestId(`board-attribute-field_dotmenu-${fieldId}`);
    }

    /** Protected (read-only) values container — shown for Status/Assignee. */
    readonlyValuesNear(name: string): Locator {
        return this.container.locator('tr').
            filter({has: this.nameInputByValue(name)}).
            getByTestId('property-values-readonly');
    }

    /** Lock icon shown next to the dot menu on protected rows. */
    lockIconNear(name: string): Locator {
        return this.container.locator('tr').
            filter({has: this.nameInputByValue(name)}).
            locator('[class*="LockOutlineIcon"], svg').
            first();
    }

    /** Editable values container — shown for non-protected select/multiselect rows. */
    editableValuesNear(name: string): Locator {
        return this.container.locator('tr').
            filter({has: this.nameInputByValue(name)}).
            getByTestId('property-values-input');
    }

    /** An option chip inside a row's values container. */
    optionChip(name: string): Locator {
        return this.container.getByText(name, {exact: true});
    }

    // ── Actions ─────────────────────────────────────────────────────────

    async addAttribute() {
        await this.addAttributeButton.click();
    }

    /**
     * Click Save and wait for the panel to settle (save complete, no pending
     * dirty state). Mirrors the SystemProperties helper.
     */
    async saveAndWaitForSettled() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();

        // After save, the button returns to a disabled state because there
        // are no pending changes.
        await expect(this.saveButton).toBeDisabled();
    }
}
