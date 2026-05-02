// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

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
        this.changesList = this.messageBody.locator('ul.changes-list');
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
        this.container = container.locator('.SystemUserDetail');

        // Header
        this.backLink = this.container.locator('.admin-console__header .back');
        this.header = this.container.getByText('User Configuration', {exact: true});

        // User Card
        this.userCard = new AdminUserCard(this.container.locator('.AdminUserCard'));

        // Team Membership Panel
        this.teamMembershipPanel = new TeamMembershipPanel(
            this.container.locator('.AdminPanel').filter({hasText: 'Team Membership'}),
        );

        // Save Changes confirmation modal (page-level, rendered outside container via portal)
        this.saveChangesModal = new SaveChangesModal(
            this.container.page().locator('#admin-userDetail-saveChangesModal'),
        );

        // Save section
        this.saveButton = this.container.getByTestId('saveSetting');
        this.cancelButton = this.container.getByRole('button', {name: 'Cancel'});
        this.errorMessage = this.container.locator('.error-message');
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
    readonly authDataInput: Locator;
    readonly authenticationMethod: Locator;

    // Footer section
    readonly resetPasswordButton: Locator;
    readonly deactivateButton: Locator;
    readonly manageUserSettingsButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        // Header
        const header = container.locator('.AdminUserCard__header');
        this.profileImage = header.locator('.Avatar');
        this.displayName = header.locator('.AdminUserCard__user-info span').first();
        this.nickname = header.locator('.AdminUserCard__user-nickname');
        this.userId = header.locator('.AdminUserCard__user-id');

        // Body
        this.body = container.locator('.AdminUserCard__body');
        this.twoColumnLayout = this.body.locator('.two-column-layout');
        this.fieldRows = this.body.locator('.field-row');

        // System fields — wrapping <label> supplies accessible names (FormattedMessage CPA labels do not use span:text-is).
        this.usernameInput = this.container.getByLabel('Username', {exact: true});
        this.emailInput = this.container.getByLabel('Email', {exact: true});
        this.authDataInput = this.container.getByLabel('Auth Data', {exact: true});
        this.authenticationMethod = this.container
            .locator('label')
            .filter({hasText: 'Authentication Method'})
            .locator('span')
            .last();

        // Footer
        const footer = container.locator('.AdminUserCard__footer');
        this.resetPasswordButton = footer.getByRole('button', {name: 'Reset Password'});
        this.deactivateButton = footer.getByRole('button', {name: 'Deactivate'});
        this.manageUserSettingsButton = footer.getByRole('button', {name: 'Manage User Settings'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Text / email / URL / native select: label wraps control — getByLabel is stable for CPA + system fields.
     */
    getFieldInputByExactLabel(labelText: string): Locator {
        return this.container.getByLabel(labelText, {exact: true});
    }

    getSelectByExactLabel(labelText: string): Locator {
        return this.container.getByLabel(labelText, {exact: true});
    }

    getFieldError(labelText: string): Locator {
        return this.container
            .getByLabel(labelText, {exact: true})
            .locator('xpath=ancestor::label[1]')
            .locator('.field-error');
    }

    /** CPA multiselect is react-select inside `label.cpa-field` (no single labeled native control). */
    getCpaMultiselectContainer(labelText: string): Locator {
        return this.container.locator('label.cpa-field').filter({hasText: labelText});
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
        this.teamRows = container.locator('.TeamRow');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.title).toBeVisible();
    }
}
