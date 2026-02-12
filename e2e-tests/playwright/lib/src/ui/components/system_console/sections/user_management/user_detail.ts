// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

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

        // Footer
        const footer = container.locator('.AdminUserCard__footer');
        this.resetPasswordButton = footer.getByRole('button', {name: 'Reset Password'});
        this.deactivateButton = footer.getByRole('button', {name: 'Deactivate'});
        this.manageUserSettingsButton = footer.getByRole('button', {name: 'Manage User Settings'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getFieldByLabel(labelText: string): Locator {
        return this.body.getByLabel(labelText);
    }

    getSelectByLabel(labelText: string): Locator {
        return this.body.getByLabel(labelText);
    }

    async fillField(labelText: string, value: string) {
        const input = this.getFieldByLabel(labelText);
        await input.clear();
        await input.fill(value);
    }

    async getFieldValue(labelText: string): Promise<string> {
        const input = this.getFieldByLabel(labelText);
        return await input.inputValue();
    }

    async getUserId(): Promise<string> {
        const text = (await this.userId.textContent()) ?? '';
        return text.replace('User ID: ', '');
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

    async clickAddTeam() {
        await this.addTeamButton.click();
    }

    async getTeamCount(): Promise<number> {
        return this.teamRows.count();
    }

    getTeamRowByIndex(index: number): TeamRow {
        return new TeamRow(this.teamRows.nth(index));
    }

    getTeamRowByName(teamName: string): TeamRow {
        return new TeamRow(this.teamRows.filter({hasText: teamName}));
    }
}

class TeamRow {
    readonly container: Locator;
    readonly teamName: Locator;
    readonly teamType: Locator;
    readonly role: Locator;
    readonly actionMenuButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.teamName = container.locator('.TeamRow__team-name b');
        this.teamType = container.locator('.TeamRow__description').first();
        this.role = container.locator('.TeamRow__description').last();
        this.actionMenuButton = container.locator('.TeamRow__actions button');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getTeamName(): Promise<string> {
        return (await this.teamName.textContent()) ?? '';
    }

    async getTeamType(): Promise<string> {
        return (await this.teamType.textContent()) ?? '';
    }

    async getRole(): Promise<string> {
        return (await this.role.textContent()) ?? '';
    }

    async openActionMenu() {
        await this.actionMenuButton.click();
    }
}
