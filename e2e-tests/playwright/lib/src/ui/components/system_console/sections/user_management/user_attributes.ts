// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

const USER_ATTRIBUTES_URL = '/admin_console/system_attributes/user_attributes';

export default class UserAttributesSection extends BaseComponent {
    readonly page: ReturnType<Locator['page']>;

    readonly createButton: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container.getByTestId('systemProperties'));
        this.page = container.page();

        this.createButton = this.container.getByRole('button', {
            name: en['admin.system_properties.user_properties.add_property'],
        });
        this.saveButton = this.page.getByTestId('saveSetting');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async goto() {
        await this.page.goto(USER_ATTRIBUTES_URL);
        await this.page.waitForLoadState('networkidle');
    }

    // ── Attribute list ──────────────────────────────────────────────────

    get attributeList(): Locator {
        return this.container.getByTestId('property-field-input');
    }

    attributeByName(name: string): Locator {
        return this.container.locator(`input[value="${name}"]`);
    }

    // ── Name inputs ─────────────────────────────────────────────────────

    lastNameInput(): Locator {
        return this.container.getByTestId('property-field-input').last();
    }

    // ── Display name inputs ──────────────────────────────────────────────

    get displayNameInput(): Locator {
        return this.container.getByTestId('property-display-name-input').last();
    }

    displayNameInputByIdentifier(identifierValue: string): Locator {
        return this.container
            .locator('tr')
            .filter({has: this.attributeByName(identifierValue)})
            .getByTestId('property-display-name-input');
    }

    lastDisplayNameInput(): Locator {
        return this.container.getByTestId('property-display-name-input').last();
    }

    // ── Type selector ────────────────────────────────────────────────────

    lastTypeSelector(): Locator {
        return this.container.getByTestId('fieldTypeSelectorMenuButton').last();
    }

    // ── Rank inputs ──────────────────────────────────────────────────────

    rankInput(name: string): Locator {
        return this.container
            .locator('tr')
            .filter({has: this.attributeByName(name)})
            .getByTestId('userPropertyRankValuesAddInput');
    }

    rankChips(): Locator {
        return this.container.getByTestId('userPropertyRankValuesChip');
    }

    rankChip(name: string): Locator {
        return this.container
            .getByTestId('userPropertyRankValuesChip')
            .filter({has: this.page.getByText(name, {exact: true})});
    }

    rankBadge(name: string): Locator {
        return this.rankChip(name).getByTestId('rankBadge');
    }

    async rankChipLabels(): Promise<string[]> {
        return this.rankChips().getByTestId('userPropertyRankValuesChipLabel').allInnerTexts();
    }

    // ── Dot-menu ─────────────────────────────────────────────────────────

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

    deleteButton(name: string): Locator {
        return this.container
            .locator('tr')
            .filter({has: this.attributeByName(name)})
            .getByTestId(/user-property-field_dotmenu-/);
    }

    async deleteAttribute() {
        await this.page
            .getByRole('menuitem', {name: en['admin.system_properties.user_properties.dotmenu.delete.label']})
            .click();
    }

    async confirmDeletion() {
        await this.page.getByRole('button', {name: en['admin.system_properties.confirm.delete.button']}).click();
    }

    async duplicateAttribute() {
        await this.page
            .getByRole('menuitem', {name: en['admin.system_properties.user_properties.dotmenu.duplicate.label']})
            .click();
    }

    async setVisibility(option: string) {
        await this.page
            .getByRole('menuitem', {name: en['admin.system_properties.user_properties.dotmenu.visibility.label']})
            .hover();
        const radioOption = this.page.getByRole('menuitemradio', {name: option});
        await expect(radioOption).toBeAttached();
        await radioOption.click({force: true});
    }

    async toggleEditableByUsers() {
        await this.page
            .getByRole('menuitemcheckbox', {
                name: en['admin.system_properties.user_properties.dotmenu.editable_by_users.label'],
            })
            .click();
    }

    async dismissMenu() {
        await this.page.keyboard.press('Escape');
    }

    // ── CRUD actions ──────────────────────────────────────────────────────

    async addAttribute() {
        await this.createButton.click();
    }

    async selectLastType(typeName: string) {
        await this.lastTypeSelector().click();
        await this.page.getByRole('menuitemradio', {name: typeName, exact: true}).click();
    }

    async selectTypeForField(nameValue: string, typeName: string) {
        const inputs = this.container.getByTestId('property-field-input');
        const count = await inputs.count();
        for (let i = 0; i < count; i++) {
            const value = await inputs.nth(i).inputValue();
            if (value === nameValue) {
                await this.container.getByTestId('fieldTypeSelectorMenuButton').nth(i).click();
                await this.page.getByRole('menuitemradio', {name: typeName, exact: true}).click();
                return;
            }
        }
        throw new Error(`No field named "${nameValue}" found in the user attributes table`);
    }

    async addOptionsToLast(values: string[]) {
        const input = this.container.locator('input[id^="react-select-"]').last();
        for (const value of values) {
            await input.fill(value);
            await input.press('Enter');
        }
    }

    // ── Ranked field actions ──────────────────────────────────────────────

    async addRankValuesToLast(values: string[]) {
        const cell = this.container.getByTestId('userPropertyRankValues').last();
        const input = cell.getByTestId('userPropertyRankValuesAddInput');
        for (const value of values) {
            await input.fill(value);
            await input.press('Enter');
        }
    }

    async openRankChipPopover(name: string) {
        await this.rankChip(name).click();
    }

    rankPopoverLabelInput(): Locator {
        return this.page
            .getByRole('menu', {name: en['admin.system_properties.user_properties.rank_popover.aria_label']})
            .getByRole('textbox');
    }

    rankPopoverRankSubmenu(): Locator {
        return this.page.getByRole('menuitem', {
            name: en['admin.system_properties.user_properties.rank_popover.rank'],
        });
    }

    async moveRankOptionToPosition(rankValue: number) {
        await this.rankPopoverRankSubmenu().hover();
        await this.page.getByRole('menuitemradio', {name: String(rankValue), exact: true}).click();
    }

    async removeRankOptionFromPopover() {
        await this.page
            .getByRole('menuitem', {name: en['admin.system_properties.user_properties.rank_popover.remove']})
            .click();
    }

    async openEditRanking(fieldId: string) {
        await this.openDotMenu(fieldId);
        await this.page
            .getByRole('menuitem', {name: en['admin.system_properties.user_properties.dotmenu.edit_ranking.label']})
            .click();
    }

    async openEditRankingForUnsaved() {
        await this.openDotMenuForUnsaved();
        await this.page
            .getByRole('menuitem', {name: en['admin.system_properties.user_properties.dotmenu.edit_ranking.label']})
            .click();
    }

    // ── Ranked schema modal ───────────────────────────────────────────────

    rankedModal(): Locator {
        return this.page.locator('#rankedSchemaModal');
    }

    rankedModalRows(): Locator {
        return this.rankedModal().getByTestId('rankedSchemaRow');
    }

    rankedModalSaveButton(): Locator {
        return this.rankedModal().getByRole('button', {name: en.save});
    }

    rankedModalAddInput(): Locator {
        return this.rankedModal().getByTestId('rankedSchemaAddInput');
    }

    async addRankedModalValue() {
        await this.rankedModal()
            .getByRole('button', {name: en['admin.system_properties.user_properties.ranked_modal.add_value']})
            .click();
    }

    async saveRankedModal() {
        await this.rankedModalSaveButton().click();
    }

    // ── Validation ────────────────────────────────────────────────────────

    identifierValidationError(): Locator {
        return this.container.getByTestId('property-field-validation-error');
    }

    cellErrorIconForField(nameValue: string): Locator {
        return this.container
            .locator('tr')
            .filter({has: this.attributeByName(nameValue)})
            .getByTestId('property-field-validation-error');
    }

    validationBannerByTitle(title: string | RegExp): Locator {
        return this.container.getByTestId('alertBanner').filter({hasText: title});
    }

    // ── Save ──────────────────────────────────────────────────────────────

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
}
