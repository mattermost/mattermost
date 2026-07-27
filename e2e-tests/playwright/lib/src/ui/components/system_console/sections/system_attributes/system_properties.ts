// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

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

    displayNameInput(nth: number): Locator {
        return this.container.getByTestId('property-display-name-input').nth(nth);
    }

    displayNameInputNear(identifierValue: string): Locator {
        return this.container
            .locator('tr')
            .filter({has: this.nameInputByValue(identifierValue)})
            .getByTestId('property-display-name-input');
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

    /**
     * Variants that always target the most recently added row, regardless of
     * how many pre-existing fields are already in the table.  Use these after
     * addAttribute() so that concurrent tests inserting UAAE/ABAC fields do
     * not shift the nth-index and target the wrong row.
     */
    lastNameInput(): Locator {
        return this.container.getByTestId('property-field-input').last();
    }

    lastDisplayNameInput(): Locator {
        return this.container.getByTestId('property-display-name-input').last();
    }

    lastTypeSelector(): Locator {
        return this.container.getByTestId('fieldTypeSelectorMenuButton').last();
    }

    lastValuesInput(): Locator {
        return this.container.locator('input[id^="react-select-"]').last();
    }

    rowByName(name: string): Locator {
        const escapedName = name.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
        return this.container.locator('tr', {
            has: this.page.locator(`input[data-testid="property-field-input"][value="${escapedName}"]`),
        });
    }

    reorderButtonByName(name: string): Locator {
        return this.rowByName(name).getByRole('button', {name: 'Reorder row'});
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

    async selectLastType(typeName: string) {
        await this.lastTypeSelector().click();
        await this.page.getByRole('menuitemradio', {name: typeName, exact: true}).click();
    }

    async addOptionToLast(value: string) {
        const input = this.lastValuesInput();
        await input.fill(value);
        await input.press('Enter');
    }

    async addOptionsToLast(values: string[]) {
        for (const value of values) {
            await this.addOptionToLast(value);
        }
    }

    /**
     * Select a type for the field identified by its current displayed name.
     * Resolves the row index dynamically so it is not affected by concurrent
     * tests that insert extra rows (e.g. UAAE / ABAC admin_editing tests).
     */
    async selectTypeForField(nameValue: string, typeName: string) {
        const inputs = this.container.getByTestId('property-field-input');
        const count = await inputs.count();
        for (let i = 0; i < count; i++) {
            const value = await inputs.nth(i).inputValue();
            if (value === nameValue) {
                await this.typeSelector(i).click();
                await this.page.getByRole('menuitemradio', {name: typeName, exact: true}).click();
                return;
            }
        }
        throw new Error(`No field named "${nameValue}" found in the user attributes table`);
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
            (resp) =>
                resp.url().includes('/api/v4/custom_profile_attributes/fields') && resp.request().method() !== 'GET',
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

    identifierValidationError(): Locator {
        return this.container.getByTestId('property-field-validation-error');
    }

    /**
     * Resolves the in-cell error icon for the row whose Name input currently
     * equals `nameValue`. Use this to assert a *specific* row is highlighted
     * (rather than `identifierValidationError()` which matches any row).
     */
    cellErrorIconForField(nameValue: string): Locator {
        return this.container
            .locator('tr')
            .filter({has: this.nameInputByValue(nameValue)})
            .getByTestId('property-field-validation-error');
    }

    /**
     * Resolves the warning AlertBanner whose title text matches `title`.
     * Banners stack below the table; one per unique error type.
     * Each banner has data-testid set to its validation warning id (e.g. 'user_properties.validation.name_required').
     */
    validationBannerByTitle(title: string | RegExp): Locator {
        return this.container.getByTestId(/^user_properties\.validation/).filter({hasText: title});
    }

    validationMessage(text: string | RegExp): Locator {
        return this.container.getByText(text);
    }

    // ── Ranked fields ───────────────────────────────────────────────────

    /**
     * The ranked-values cell for the most recently added row. Ranked rows
     * render numbered chips + an add-value input instead of the react-select.
     */
    lastRankValues(): Locator {
        return this.container.getByTestId('user-property-rank-values').last();
    }

    /**
     * Add-value input inside the ranked-values cell (auto-assigns next rank).
     * Located by testid, not placeholder: the placeholder ('Add values… (required)')
     * only renders in the empty state and disappears once a value is added, so
     * placeholder-based lookups break when adding more than one value.
     */
    rankAddInput(): Locator {
        return this.lastRankValues().getByTestId('user-property-rank-values__add-input');
    }

    async addRankValueToLast(value: string) {
        const input = this.rankAddInput();
        await input.fill(value);
        await input.press('Enter');
    }

    async addRankValuesToLast(values: string[]) {
        for (const value of values) {
            await this.addRankValueToLast(value);
        }
    }

    /** All ranked chip spans, in DOM order (ascending rank, left→right). */
    rankChips(): Locator {
        return this.container.getByTestId('user-property-rank-values__chip');
    }

    /**
     * A single ranked chip span by its option label. Unlike the test-id
     * locator, this works for both newly-added options (no server id yet) and
     * API-created options (real id). Exact text avoids matching "Secret"
     * inside "TopSecret".
     */
    rankChip(name: string): Locator {
        return this.container
            .getByTestId('user-property-rank-values__chip')
            .filter({has: this.page.getByText(name, {exact: true})});
    }

    /** The numbered badge inside a chip; its text is the rank integer. */
    rankBadge(name: string): Locator {
        return this.rankChip(name).getByTestId('rank-badge');
    }

    /** Ordered chip labels as displayed (trimmed of the badge text). */
    async rankChipLabels(): Promise<string[]> {
        return this.rankChips().getByTestId('user-property-rank-values__chip-label').allInnerTexts();
    }

    // Per-chip popover (rendered at page level via portal).

    async openRankChipPopover(name: string) {
        await this.rankChip(name).click();
    }

    /**
     * The label textbox in the per-chip popover. The Input widget surfaces
     * "Option label" as a floating ARIA label (not a placeholder attribute),
     * so locate it by role within the popover menu.
     */
    rankPopoverLabelInput(): Locator {
        return this.page.getByRole('menu', {name: 'Edit option'}).getByRole('textbox');
    }

    rankPopoverRankSubmenu(): Locator {
        return this.page.getByRole('menuitem', {name: /^Rank/});
    }

    async moveRankOptionToPosition(rankValue: number) {
        await this.rankPopoverRankSubmenu().hover();
        await this.page.getByRole('menuitemradio', {name: String(rankValue), exact: true}).click();
    }

    async removeRankOptionFromPopover() {
        await this.page.getByRole('menuitem', {name: 'Remove option'}).click();
    }

    async openEditRanking(fieldId: string) {
        await this.openDotMenu(fieldId);
        await this.page.getByRole('menuitem', {name: 'Edit ranking'}).click();
    }

    async openEditRankingForUnsaved() {
        await this.openDotMenuForUnsaved();
        await this.page.getByRole('menuitem', {name: 'Edit ranking'}).click();
    }

    // ── Ranked schema modal ─────────────────────────────────────────────

    rankedModal(): Locator {
        return this.page.locator('#rankedSchemaModal');
    }

    rankedModalRows(): Locator {
        return this.rankedModal().getByTestId('rankedSchemaRow');
    }

    rankedModalSaveButton(): Locator {
        return this.rankedModal().getByRole('button', {name: 'Save'});
    }

    async addRankedModalValue() {
        await this.rankedModal().getByRole('button', {name: 'Add value'}).click();
    }

    async saveRankedModal() {
        await this.rankedModalSaveButton().click();
    }
}
