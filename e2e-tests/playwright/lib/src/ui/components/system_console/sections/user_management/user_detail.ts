// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {ConfirmModal} from '@/ui/components/system_console/base_modal';

/**
 * Save Changes confirmation modal on the User Detail page.
 * Shown when saving edits to user fields (email, username, auth data, etc.).
 */
export class SaveChangesModal extends ConfirmModal {
    readonly messageBody: Locator;
    readonly changesList: Locator;

    constructor(container: Locator) {
        super(container);
        this.messageBody = this.container.locator('#confirmModalBody');
        this.changesList = this.messageBody.getByTestId('changesList');
    }

    /**
     * Get the list of change summary texts shown in the modal.
     */
    async getChanges(): Promise<string[]> {
        const items = this.changesList.locator('li');
        const count = await items.count();
        const changes: string[] = [];
        for (let i = 0; i < count; i++) {
            changes.push(((await items.nth(i).textContent()) ?? '').trim());
        }
        return changes;
    }
}

/**
 * System Console -> User Management -> Users -> User Detail
 * Accessed by clicking on a user row in the Users list
 */
export default class UserDetail {
    readonly container: Locator;

    // Header
    readonly backLink: Locator;
    readonly header: Locator;

    // User Card
    readonly userCard: AdminUserCard;

    // Team Membership Panel
    readonly teamMembershipPanel: TeamMembershipPanel;

    // Save Changes confirmation modal
    readonly saveChangesModal: SaveChangesModal;

    // Save section
    readonly saveButton: Locator;
    readonly cancelButton: Locator;
    readonly errorMessage: Locator;

    constructor(container: Locator) {
        this.container = container.getByTestId('systemUserDetail');

        // Header
        this.backLink = this.container.getByTestId('adminHeader-backLink');
        this.header = this.container.getByText('User Configuration', {exact: true});

        // User Card
        this.userCard = new AdminUserCard(this.container.getByTestId('adminUserCard'));

        // Team Membership Panel
        this.teamMembershipPanel = new TeamMembershipPanel(this.container.locator('#teamMembershipPanel'));

        // Save Changes confirmation modal (page-level, rendered outside container via portal)
        this.saveChangesModal = new SaveChangesModal(
            this.container.page().locator('#admin-userDetail-saveChangesModal'),
        );

        // Save section
        this.saveButton = this.container.getByTestId('saveSetting');
        this.cancelButton = this.container.getByRole('button', {name: 'Cancel'});
        this.errorMessage = this.container.getByTestId('saveChangesPanel-errorMessage');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async goBack() {
        await this.backLink.click();
    }

    async save() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
    }

    async cancel() {
        await expect(this.cancelButton).toBeVisible();
        await this.cancelButton.click();
    }

    /**
     * Wait for a confirmed save to finish. Save is also disabled while saving, so it can't signal completion;
     * Cancel renders only while there are unsaved changes, which last until the save succeeds.
     */
    async waitForSaveComplete() {
        await expect(this.cancelButton).not.toBeVisible();
        await expect(this.saveButton).toBeDisabled();
    }
}

class AdminUserCard {
    readonly container: Locator;

    // Header section
    readonly profileImage: Locator;
    readonly displayName: Locator;
    readonly nickname: Locator;
    readonly userId: Locator;

    // Body section (two-column layout with fields)
    readonly body: Locator;
    readonly twoColumnLayout: Locator;
    readonly fieldRows: Locator;

    // System field inputs (scoped via wrapping <label> to avoid substring ambiguity)
    readonly usernameInput: Locator;
    readonly emailInput: Locator;
    readonly firstNameInput: Locator;
    readonly lastNameInput: Locator;
    readonly authDataInput: Locator;
    readonly authenticationMethod: Locator;

    // Footer section
    readonly resetPasswordButton: Locator;
    readonly deactivateButton: Locator;
    readonly manageUserSettingsButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        // Header
        const header = container.getByTestId('adminUserCard-header');
        this.profileImage = header.locator('img').first();
        this.displayName = container.getByTestId('adminUserCard-userInfo').locator('span').first();
        this.nickname = container.getByTestId('adminUserCard-userNickname');
        this.userId = container.getByTestId('adminUserCard-userId');

        // Body
        this.body = container.getByTestId('adminUserCard-body');
        this.twoColumnLayout = this.body.getByTestId('twoColumnLayout');
        this.fieldRows = this.body.getByTestId('fieldRow');

        // System fields — use exact label text to avoid substring matches (e.g., "Email" vs "Work Email")
        this.usernameInput = this.getFieldInputByExactLabel('Username');
        this.emailInput = this.getFieldInputByExactLabel('Email');
        this.firstNameInput = this.getFieldInputByExactLabel('First Name');
        this.lastNameInput = this.getFieldInputByExactLabel('Last Name');
        this.authDataInput = this.getFieldInputByExactLabel('Auth Data');
        this.authenticationMethod =
            this.getFieldColumn('Authentication Method').getByTestId('authenticationMethodValue');

        // Footer
        const footer = container.getByTestId('adminUserCard-footer');
        this.resetPasswordButton = footer.getByRole('button', {name: 'Reset Password'});
        this.deactivateButton = footer.getByRole('button', {name: 'Deactivate'});
        this.manageUserSettingsButton = footer.getByRole('button', {name: 'Manage User Settings'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expectAuthenticationMethod(text: string | RegExp) {
        await expect(this.authenticationMethod).toHaveText(text);
    }

    /**
     * Get the field-column container for a field by its exact label text.
     */
    private getFieldColumn(labelText: string): Locator {
        return this.body.getByTestId('fieldColumn').filter({has: this.body.page().getByText(labelText, {exact: true})});
    }

    /**
     * Get the input inside a field column by exact label text.
     * Avoids substring ambiguity (e.g., "Email" won't match "Work Email").
     */
    getFieldInputByExactLabel(labelText: string): Locator {
        return this.getFieldColumn(labelText).locator('input');
    }

    /**
     * Get the field-error validation message locator for a field by its exact label text.
     */
    getFieldError(labelText: string): Locator {
        return this.getFieldColumn(labelText).getByTestId('fieldError');
    }

    // ── Select / multiselect CPA combobox ───────────────────────────────

    /** The combobox input of a select or multiselect CPA field, located by its exact label. */
    getCpaCombobox(labelText: string): Locator {
        return this.getFieldColumn(labelText).getByRole('combobox', {name: labelText, exact: true});
    }

    /** The field-name <label> that points at a CPA combobox. */
    getCpaFieldLabel(labelText: string): Locator {
        return this.getFieldColumn(labelText)
            .locator('label')
            .filter({has: this.body.page().getByText(labelText, {exact: true})});
    }

    /** The combobox's option list. It is portaled to the page and only rendered while open. */
    async getCpaComboboxListbox(labelText: string): Promise<Locator> {
        const listboxId = await this.getCpaCombobox(labelText).getAttribute('aria-controls');
        if (!listboxId) {
            throw new Error(`Combobox "${labelText}" has no aria-controls`);
        }
        return this.body.page().locator(`#${listboxId}`);
    }

    /** Open a CPA combobox by clicking it (focus alone doesn't open it) and return its listbox. */
    async openCpaCombobox(labelText: string): Promise<Locator> {
        const combobox = this.getCpaCombobox(labelText);
        await combobox.click();
        await expect(combobox).toHaveAttribute('aria-expanded', 'true');
        return this.getCpaComboboxListbox(labelText);
    }

    /**
     * Open the combobox and pick an option by its exact label. The menu closes after the pick.
     * In a multiselect, picking an already-selected option deselects it.
     */
    async selectCpaOption(labelText: string, optionName: string): Promise<void> {
        const listbox = await this.openCpaCombobox(labelText);
        await listbox.getByRole('option', {name: optionName, exact: true}).click();
        await expect(this.getCpaCombobox(labelText)).toHaveAttribute('aria-expanded', 'false');
    }

    /** The clear (×) button of a select CPA combobox. It renders only while the field has a value. */
    getCpaComboboxClearButton(labelText: string): Locator {
        return this.getFieldColumn(labelText).getByRole('button', {name: `Clear ${labelText}`, exact: true});
    }

    /** Selected-value chips of a multiselect CPA field, in display order. */
    getCpaChips(labelText: string): Locator {
        return this.getFieldColumn(labelText).locator('[data-chip]');
    }

    /** Remove a chip by its exact label. The remove icon is aria-hidden, so it's found by its data attribute. */
    async removeCpaChip(labelText: string, chipText: string): Promise<void> {
        await this.getCpaChips(labelText)
            .filter({has: this.body.page().getByText(chipText, {exact: true})})
            .locator('[data-chip-remove]')
            .click();
    }

    // ── Ranked CPA picker ───────────────────────────────────────────────

    /** The menu-button for a ranked CPA field, located by its exact label. */
    getCpaRankPicker(labelText: string): Locator {
        return this.getFieldColumn(labelText).getByRole('button');
    }

    /** The open ranked-value menu (rendered at page level via portal). */
    cpaRankMenu(): Locator {
        return this.body.page().getByRole('menu', {name: 'Select an option'});
    }

    /** Menu option rows, in DOM order (highest rank first). */
    cpaRankMenuItems(): Locator {
        return this.cpaRankMenu().getByRole('menuitemradio');
    }

    async openCpaRankPicker(labelText: string): Promise<void> {
        await this.getCpaRankPicker(labelText).click();
    }

    /** Open the picker and choose an option by its exact label. */
    async selectCpaRankValue(labelText: string, optionName: string): Promise<void> {
        await this.openCpaRankPicker(labelText);
        await this.cpaRankMenu().getByText(optionName, {exact: true}).click();
    }
}

class TeamMembershipPanel {
    readonly container: Locator;
    readonly title: Locator;
    readonly description: Locator;
    readonly addTeamButton: Locator;
    readonly teamRows: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.title = container.getByRole('heading', {name: 'Team Membership'});
        this.description = container.getByText('Teams to which this user belongs');
        this.addTeamButton = container.getByRole('button', {name: 'Add Team'});
        this.teamRows = container.getByTestId('teamRow');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.title).toBeVisible();
    }
}
