// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * System Console -> User Management -> Delegated Granular Administration -> [Role] Edit
 * This page is shown when editing a specific role (e.g., System Manager, User Manager, etc.)
 */
export default class SystemRoles {
    readonly container: Locator;

    // Header
    readonly backLink: Locator;
    readonly roleName: Locator;

    // Privileges Panel
    readonly privilegesPanel: PrivilegesPanel;

    // Assigned People Panel
    readonly assignedPeoplePanel: AssignedPeoplePanel;

    // Save section
    readonly saveButton: Locator;
    readonly cancelButton: Locator;
    readonly errorMessage: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.backLink = container.locator('.admin-console__header .back');
        this.roleName = container.locator('.admin-console__header span').last();

        this.privilegesPanel = new PrivilegesPanel(container.locator('#SystemRolePermissions'));
        this.assignedPeoplePanel = new AssignedPeoplePanel(container.locator('#SystemRoleUsers'));

        this.saveButton = container.getByTestId('saveSetting');
        this.cancelButton = container.getByRole('link', {name: 'Cancel'});
        this.errorMessage = container.locator('.error-message');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.roleName).toBeVisible();
    }

    async goBack() {
        await this.backLink.click();
    }

    async save() {
        await this.saveButton.click();
    }

    async cancel() {
        await this.cancelButton.click();
    }

    async getRoleName(): Promise<string> {
        return (await this.roleName.textContent()) ?? '';
    }
}

class PrivilegesPanel {
    readonly container: Locator;
    readonly title: Locator;
    readonly description: Locator;

    // Permission sections
    readonly about: PermissionSection;
    readonly reporting: PermissionSection;
    readonly userManagement: PermissionSection;
    readonly environment: PermissionSection;
    readonly siteConfiguration: PermissionSection;
    readonly authentication: PermissionSection;
    readonly plugins: PermissionSection;
    readonly integrations: PermissionSection;
    readonly compliance: PermissionSection;
    readonly experimental: PermissionSection;

    constructor(container: Locator) {
        this.container = container;
        this.title = container.getByRole('heading', {name: 'Privileges'});
        this.description = container.getByText('Level of access to the system console.');

        // Permission sections
        this.about = new PermissionSection(container, 'permission_section_about');
        this.reporting = new PermissionSection(container, 'permission_section_reporting');
        this.userManagement = new PermissionSection(container, 'permission_section_user_management');
        this.environment = new PermissionSection(container, 'permission_section_environment');
        this.siteConfiguration = new PermissionSection(container, 'permission_section_site');
        this.authentication = new PermissionSection(container, 'permission_section_authentication');
        this.plugins = new PermissionSection(container, 'permission_section_plugins');
        this.integrations = new PermissionSection(container, 'permission_section_integrations');
        this.compliance = new PermissionSection(container, 'permission_section_compliance');
        this.experimental = new PermissionSection(container, 'permission_section_experimental');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.title).toBeVisible();
    }
}

class PermissionSection {
    readonly container: Locator;
    readonly row: Locator;
    readonly title: Locator;
    readonly description: Locator;
    readonly subsectionsToggle: Locator;
    readonly dropdownButton: Locator;
    readonly subsectionsContainer: Locator;

    private readonly panelContainer: Locator;
    private readonly testId: string;
    private readonly sectionName: string;

    constructor(panelContainer: Locator, testId: string) {
        this.panelContainer = panelContainer;
        this.testId = testId;
        // Extract section name from testId (e.g., 'permission_section_user_management' -> 'user_management')
        this.sectionName = testId.replace('permission_section_', '');

        this.container = panelContainer.getByTestId(testId);
        // Use CSS :has() selector to find the row containing this section
        this.row = panelContainer.locator(`.PermissionRow:has([data-testid="${testId}"])`);
        this.title = this.container.locator('.PermissionSectionText_title');
        this.description = this.container.locator('.PermissionSection_description');
        this.subsectionsToggle = this.container.locator('.PermissionSubsectionsToggle button');
        // Use the dropdown button ID which is more reliable
        this.dropdownButton = panelContainer.page().locator(`#systemRolePermissionDropdown${this.sectionName}`);
        this.subsectionsContainer = this.row.locator('.PermissionSubsections');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Get the current permission value (e.g., "Can edit", "Read only", "No access", "Mixed access")
     */
    async getPermissionValue(): Promise<string> {
        return (await this.dropdownButton.locator('.PermissionSectionDropdownButton_text').textContent()) ?? '';
    }

    /**
     * Set permission for this section
     * @param permission - "Can edit", "Read only", or "No access"
     */
    async setPermission(permission: 'Can edit' | 'Read only' | 'No access') {
        await expect(this.dropdownButton).toBeVisible();
        await this.dropdownButton.click();

        // Wait for the MenuWrapper to have --open class which indicates menu is open
        const menuWrapper = this.dropdownButton.locator('xpath=ancestor::div[contains(@class, "MenuWrapper")]');
        await expect(menuWrapper).toHaveClass(/MenuWrapper--open/);

        // Find the menu items and click the one matching the permission
        const menuItem = menuWrapper.locator('.Menu__content li').filter({hasText: permission});
        await expect(menuItem).toBeVisible();
        await menuItem.click();

        // Wait for menu to close
        await expect(menuWrapper).not.toHaveClass(/MenuWrapper--open/);
    }

    /**
     * Expand subsections if they are collapsed
     */
    async expandSubsections() {
        const hasToggle = await this.subsectionsToggle.isVisible();
        if (!hasToggle) {
            return;
        }

        const buttonText = await this.subsectionsToggle.textContent();
        if (buttonText?.includes('Show')) {
            await this.subsectionsToggle.click();
            // Wait for subsections to be visible
            await expect(this.subsectionsContainer).toBeVisible();
        }
    }

    /**
     * Collapse subsections if they are expanded
     */
    async collapseSubsections() {
        const hasToggle = await this.subsectionsToggle.isVisible();
        if (!hasToggle) {
            return;
        }

        const buttonText = await this.subsectionsToggle.textContent();
        if (buttonText?.includes('Hide')) {
            await this.subsectionsToggle.click();
        }
    }

    /**
     * Check if subsections are visible
     */
    async hasSubsections(): Promise<boolean> {
        return this.subsectionsToggle.isVisible();
    }

    /**
     * Get a subsection by its testId suffix
     * @param subsectionName - The suffix of the subsection testId (e.g., "team_statistics" for "permission_section_reporting_team_statistics")
     */
    getSubsection(subsectionName: string): PermissionSubsection {
        const subsectionTestId = `${this.testId}_${subsectionName}`;
        return new PermissionSubsection(this.panelContainer, subsectionTestId);
    }

    // Reporting subsections shortcuts
    get siteStatistics() {
        return this.getSubsection('site_statistics');
    }
    get teamStatistics() {
        return this.getSubsection('team_statistics');
    }
    get serverLogs() {
        return this.getSubsection('server_logs');
    }

    // User Management subsections shortcuts
    get users() {
        return this.getSubsection('users');
    }
    get groups() {
        return this.getSubsection('groups');
    }
    get teams() {
        return this.getSubsection('teams');
    }
    get channels() {
        return this.getSubsection('channels');
    }
    get permissions() {
        return this.getSubsection('permissions');
    }
    get systemRoles() {
        return this.getSubsection('system_roles');
    }
}

class PermissionSubsection {
    readonly container: Locator;
    readonly title: Locator;
    readonly description: Locator;
    readonly dropdownButton: Locator;

    private readonly sectionName: string;

    constructor(panelContainer: Locator, testId: string) {
        this.container = panelContainer.getByTestId(testId);
        this.title = this.container.locator('.PermissionSectionText_title');
        this.description = this.container.locator('.PermissionSection_description');
        // Extract section name from testId (e.g., 'permission_section_user_management_teams' -> 'user_management_teams')
        this.sectionName = testId.replace('permission_section_', '');
        // Use the dropdown button ID which is more reliable
        this.dropdownButton = panelContainer.page().locator(`#systemRolePermissionDropdown${this.sectionName}`);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Get the current permission value (e.g., "Can edit", "Read only", "No access")
     */
    async getPermissionValue(): Promise<string> {
        return (await this.dropdownButton.locator('.PermissionSectionDropdownButton_text').textContent()) ?? '';
    }

    /**
     * Set permission for this subsection
     * @param permission - "Can edit", "Read only", or "No access"
     */
    async setPermission(permission: 'Can edit' | 'Read only' | 'No access') {
        // Wait for subsection to be visible
        await this.toBeVisible();

        // Click the dropdown button to open the menu
        await expect(this.dropdownButton).toBeVisible();
        await this.dropdownButton.click();

        // Wait for the MenuWrapper to have --open class which indicates menu is open
        const menuWrapper = this.dropdownButton.locator('xpath=ancestor::div[contains(@class, "MenuWrapper")]');
        await expect(menuWrapper).toHaveClass(/MenuWrapper--open/);

        // Find the menu items and click the one matching the permission
        const menuItem = menuWrapper.locator('.Menu__content li').filter({hasText: permission});
        await expect(menuItem).toBeVisible();
        await menuItem.click();

        // Wait for menu to close
        await expect(menuWrapper).not.toHaveClass(/MenuWrapper--open/);
    }
}

class AssignedPeoplePanel {
    readonly container: Locator;
    readonly title: Locator;
    readonly description: Locator;
    readonly addPeopleButton: Locator;
    readonly searchInput: Locator;
    readonly userRows: Locator;
    readonly paginationInfo: Locator;
    readonly previousPageButton: Locator;
    readonly nextPageButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.title = container.getByRole('heading', {name: 'Assigned People'});
        this.description = container.getByText('List of people assigned to this system role.');
        this.addPeopleButton = container.getByRole('button', {name: 'Add People'});
        this.searchInput = container.getByTestId('searchInput');
        this.userRows = container.locator('.DataGrid_rows .DataGrid_row');
        this.paginationInfo = container.locator('.DataGrid_footer span');
        this.previousPageButton = container.locator('.DataGrid_footer .prev');
        this.nextPageButton = container.locator('.DataGrid_footer .next');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.title).toBeVisible();
    }

    async clickAddPeople() {
        await this.addPeopleButton.click();
    }

    async searchUsers(searchTerm: string) {
        await this.searchInput.fill(searchTerm);
    }

    async clearSearch() {
        await this.searchInput.clear();
    }

    async getUserCount(): Promise<number> {
        return this.userRows.count();
    }

    /**
     * Get a user row by index (0-based)
     */
    getUserRowByIndex(index: number): AssignedUserRow {
        return new AssignedUserRow(this.userRows.nth(index));
    }

    /**
     * Get a user row by username
     */
    getUserRowByUsername(username: string): AssignedUserRow {
        const row = this.userRows.filter({hasText: username});
        return new AssignedUserRow(row);
    }
}

class AssignedUserRow {
    readonly container: Locator;
    readonly avatar: Locator;
    readonly name: Locator;
    readonly email: Locator;
    readonly removeLink: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.avatar = container.locator('.Avatar');
        this.name = container.locator('.UserGrid_name span').first();
        this.email = container.locator('.ug-email');
        this.removeLink = container.getByRole('link', {name: 'Remove'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getName(): Promise<string> {
        return (await this.name.textContent()) ?? '';
    }

    async getEmail(): Promise<string> {
        return (await this.email.textContent()) ?? '';
    }

    async remove() {
        await this.removeLink.click();
    }
}
