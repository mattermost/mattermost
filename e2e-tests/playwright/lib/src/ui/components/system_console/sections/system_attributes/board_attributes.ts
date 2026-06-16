// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

const BOARD_ATTRIBUTES_URL = '/admin_console/system_attributes/board_attributes';

export type BoardAttributeType = 'Text' | 'Select' | 'Multi-select' | 'Date' | 'User';

export type ColorTokenName = 'Default' | 'Brown' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Purple' | 'Pink' | 'Red';

/**
 * System Console -> System Attributes -> Board Attributes.
 *
 * Row-identity gotcha: controlled inputs in this table render their `value`
 * via React state, which sets the DOM `.value` PROPERTY but does NOT update
 * the `value` HTML ATTRIBUTE after the initial mount. Selectors of the form
 * `input[value="X"]` only match for rows whose initial-render value is X
 * (seeded fields, or fields persisted across reload). For unsaved /
 * just-added rows, use `lastAddedRow()` or the locator returned by
 * `addAttribute()`.
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

    // ── Visibility / navigation ─────────────────────────────────────────

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        // Wait for the seeded rows to render so name-based lookups work
        // reliably immediately after navigation — the property-fields fetch
        // can complete just after waitForLoadState('networkidle') returns.
        await expect(this.nameInputByValue('status')).toBeVisible();
        await expect(this.nameInputByValue('assignee')).toBeVisible();
    }

    async goto() {
        await this.page.goto(BOARD_ATTRIBUTES_URL);
        await this.page.waitForLoadState('domcontentloaded');
    }

    // ── Row / cell accessors ───────────────────────────────────────────

    nameInput(nth: number): Locator {
        return this.container.getByTestId('board-attribute-field-input').nth(nth);
    }

    /**
     * Find a name input by its initial-render value. Scoped to the table's
     * own name-input testid so it cannot accidentally match unrelated inputs
     * (option-rename inputs, type-filter input) that may share a value, and
     * escapes the value for safe interpolation into the CSS attribute
     * selector. See class-level comment about value-attribute caveats.
     */
    nameInputByValue(value: string): Locator {
        return this.container
            .getByTestId('board-attribute-field-input')
            .and(this.container.locator(`input[value="${escapeCssAttributeValue(value)}"]`));
    }

    lastNameInput(): Locator {
        return this.container.getByTestId('board-attribute-field-input').last();
    }

    /**
     * Find a row by the value attribute of its name input. Works for rows
     * whose initial-render value matches — i.e. seeded fields and any field
     * loaded after save+reload. Does NOT work for unsaved rows just added
     * in this session; use lastAddedRow() for those.
     */
    rowByName(name: string): Locator {
        // The `has` locator is re-rooted at each candidate <tr>, so it must
        // be a page-level locator (not a chain anchored at the table's own
        // container). Anchor on the name-input testid so the row probe
        // can't match through option chips or filter inputs.
        return this.container.locator('tr', {
            has: this.page.locator(
                `input[data-testid="board-attribute-field-input"][value="${escapeCssAttributeValue(name)}"]`,
            ),
        });
    }

    /**
     * Locator for the row containing the most recently added name input —
     * the right way to address an unsaved row. Uses the last `<tr>` in the
     * tbody since new rows append at the end.
     */
    lastAddedRow(): Locator {
        return this.container.locator('tbody tr').last();
    }

    typeSelectorInRow(row: Locator): Locator {
        return row.getByTestId('fieldTypeSelectorMenuButton');
    }

    typeSelectorByName(name: string): Locator {
        return this.typeSelectorInRow(this.rowByName(name));
    }

    dotMenuInRow(row: Locator): Locator {
        return row.locator('[data-testid^="board-attribute-field_dotmenu-"]');
    }

    dotMenuByName(name: string): Locator {
        return this.dotMenuInRow(this.rowByName(name));
    }

    optionChip(name: string): Locator {
        return this.container.getByText(name, {exact: true});
    }

    optionDeleteButtonByName(optionName: string): Locator {
        // The X-button's testid uses option.id (server id or pending id) —
        // unstable from a test perspective. Walk from the visible chip label
        // up to its ChipDropZone (carries `data-flip-key`) and locate the
        // delete button inside.
        return this.optionChip(optionName)
            .locator('xpath=ancestor::span[@data-flip-key][1]')
            .locator('button[data-testid^="property-option-delete-"]');
    }

    // ── Header / table-level actions ───────────────────────────────────

    /**
     * Click "Add attribute". When `name` is provided, fills and blurs the
     * just-added name input. Returns the row locator for the new row, which
     * the caller should use for subsequent interactions (changeTypeInRow,
     * addOptionInRow, etc.) until after save.
     */
    async addAttribute(name?: string): Promise<Locator> {
        await this.addAttributeButton.click();
        const row = this.lastAddedRow();
        if (name !== undefined) {
            const input = row.locator('[data-testid="board-attribute-field-input"]');
            await input.fill(name);
            await input.blur();
        }
        return row;
    }

    async saveAndWaitForSettled() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();

        // Save flushes pending changes; button returns to disabled state once
        // all API calls complete and React re-renders with the new baseline.
        await expect(this.saveButton).toBeDisabled({timeout: 15_000});
    }

    // ── Type menu interactions ─────────────────────────────────────────

    async openTypeMenuInRow(row: Locator) {
        await this.typeSelectorInRow(row).click();
    }

    async chooseType(type: BoardAttributeType) {
        // Scope to the type-selector menu (aria-label 'Select type') so a stray
        // open color picker can't capture the click. scrollIntoViewIfNeeded
        // covers Date/User at the bottom of the list when the menu's viewport
        // is narrow (visible-but-not-in-clipping-region clicks otherwise no-op).
        const item = this.page
            .getByRole('menu', {name: 'Select type'})
            .getByRole('menuitemradio', {name: type, exact: true});
        await item.scrollIntoViewIfNeeded();
        await item.click();
    }

    async changeTypeInRow(row: Locator, type: BoardAttributeType) {
        await this.openTypeMenuInRow(row);
        await this.chooseType(type);
        // Wait for the type selector to reflect the new choice — confirms the
        // click dispatched and React rendered the new state. Without this the
        // immediate next save() can race the dispatch and commit the old type.
        await expect(this.typeSelectorInRow(row)).toContainText(type);
    }

    async changeTypeByName(name: string, type: BoardAttributeType) {
        await this.changeTypeInRow(this.rowByName(name), type);
    }

    // ── Option / chip interactions ─────────────────────────────────────

    async addOptionInRow(row: Locator, optionName: string) {
        await row.getByRole('button', {name: 'Add value'}).click();
        const newChip = row.locator('[data-testid^="property-option-chip-"]').last();
        await newChip.click();
        const renameInput = this.page.getByPlaceholder('Option name');
        await renameInput.fill(optionName);
        await renameInput.blur();
        await this.closeChipMenu();
    }

    async addOption(rowName: string, optionName: string) {
        await this.addOptionInRow(this.rowByName(rowName), optionName);
    }

    async openOptionMenu(optionName: string) {
        await this.optionChip(optionName).click();
    }

    async renameOption(currentName: string, newName: string) {
        await this.openOptionMenu(currentName);
        const renameInput = this.page.getByPlaceholder('Option name');
        await renameInput.fill(newName);
        await renameInput.blur();
        await this.closeChipMenu();
    }

    async deleteOptionViaXButton(optionName: string) {
        await this.optionDeleteButtonByName(optionName).click();
    }

    async chooseOptionColor(color: ColorTokenName) {
        await this.page.getByRole('menuitemradio', {name: color, exact: true}).click();
    }

    async setOptionColor(optionName: string, color: ColorTokenName) {
        await this.openOptionMenu(optionName);
        await this.chooseOptionColor(color);
        await this.closeChipMenu();
    }

    /**
     * The chip menu (Menu.Container) renders as a MUI Popover whose invisible
     * backdrop intercepts pointer events. Clicking the backdrop is what
     * dismisses the popover — its onClick handler fires the Menu's close
     * callback. We try backdrop click first (most reliable) and fall back to
     * Escape if the backdrop has already detached.
     */
    async closeChipMenu() {
        const backdrop = this.page.locator('#backdropForMenuComponent');
        if ((await backdrop.count()) === 0) {
            return;
        }
        // Backdrop click is the most reliable close path — it directly fires
        // the Menu's onClose handler without relying on focus state.
        await backdrop.click({force: true});
        try {
            await backdrop.first().waitFor({state: 'detached', timeout: 3000});
            return;
        } catch {
            // Click didn't detach — try Escape as fallback.
        }
        await this.page.keyboard.press('Escape');
        await backdrop
            .first()
            .waitFor({state: 'detached', timeout: 2000})
            .catch(() => {});
    }

    // ── Dot menu interactions ──────────────────────────────────────────

    async openDotMenuInRow(row: Locator) {
        await this.dotMenuInRow(row).click();
    }

    async openDotMenuByName(name: string) {
        await this.openDotMenuInRow(this.rowByName(name));
    }

    async clickDuplicate() {
        await this.page.getByText('Duplicate', {exact: true}).click();
    }

    async clickDeleteAttribute() {
        await this.page.getByText('Delete attribute', {exact: true}).click();
    }
}

// Escape characters that have special meaning inside a CSS attribute value
// when the value is interpolated between double quotes (`[attr="..."]`).
// Backslash must be escaped first so it doesn't double-escape the quote.
function escapeCssAttributeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
