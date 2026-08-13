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

    async waitForSaveComplete() {
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
     * Get the select inside a field column by exact label text.
     */
    getSelectByExactLabel(labelText: string): Locator {
        return this.getFieldColumn(labelText).locator('select');
    }

    /**
     * Get the field-error validation message locator for a field by its exact label text.
     */
    getFieldError(labelText: string): Locator {
        return this.getFieldColumn(labelText).getByTestId('fieldError');
    }

    /**
     * Get the container for a multiselect CPA field by its exact label text.
     * Returns the .field-column wrapper which holds the multiselect component.
     */
    getCpaMultiselectContainer(labelText: string): Locator {
        return this.getFieldColumn(labelText);
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
