// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console -> User Management -> Delegated Granular Administration -> [Role] Edit
 * This page is shown when editing a specific role (e.g., System Manager, User Manager, etc.)
 */
export default class SystemRoles extends BaseComponent {
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

    // Add Users to Role modal (portal-rendered, page-level)
    readonly addUsersModal: AddUsersToRoleModal;

    constructor(container: Locator) {
        super(container);

        this.backLink = container.getByTestId('adminConsoleHeader').getByRole('link');
        this.roleName = container.getByTestId('adminConsoleHeader').getByTestId('systemRoleName');

        this.privilegesPanel = new PrivilegesPanel(container.locator('#SystemRolePermissions'));
        this.assignedPeoplePanel = new AssignedPeoplePanel(container.locator('#SystemRoleUsers'));

        this.saveButton = container.getByTestId('saveSetting');
        this.cancelButton = container.getByRole('link', {name: en['admin.team_channel_settings.cancel']});
        this.errorMessage = container.getByTestId('errorMessage');

        this.addUsersModal = new AddUsersToRoleModal(container.page().locator('#addUsersToRoleModal'));
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

    getUserRowInModal(username: string): Locator {
        return this.addUsersModal.container.getByTestId('addUsersToRoleRow').filter({hasText: username});
    }

    getRoleCheckboxByName(name: string): Locator {
        return this.addUsersModal.container
            .getByTestId('addUsersToRoleRow')
            .filter({hasText: name})
            .getByRole('checkbox');
    }

    getModalSaveButton(): Locator {
        return this.addUsersModal.saveButton;
    }
}

class AddUsersToRoleModal extends BaseComponent {
    readonly searchInput: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.searchInput = container.getByRole('combobox', {name: en['multiselect.placeholder']});
        this.saveButton = container.locator('#saveItems');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

class PrivilegesPanel extends BaseComponent {
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
        super(container);
        this.title = container.getByRole('heading', {name: en['admin.permissions.system_role_permissions.title']});
        this.description = container.getByText(en['admin.permissions.system_role_permissions.description']);

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

class PermissionSection extends BaseComponent {
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
        super(panelContainer.getByTestId(testId));
        this.panelContainer = panelContainer;
        this.testId = testId;
        // Extract section name from testId (e.g., 'permission_section_user_management' -> 'user_management')
        this.sectionName = testId.replace('permission_section_', '');
        this.row = panelContainer.getByTestId('permissionRow').filter({has: panelContainer.getByTestId(testId)});
        this.title = this.container.getByTestId('permissionSectionTitle');
        this.description = this.container.getByTestId('permissionSectionDescription');
        this.subsectionsToggle = this.container.getByTestId('permissionSubsectionsToggle');
        // Use the dropdown button ID which is more reliable
        this.dropdownButton = panelContainer.page().locator(`#systemRolePermissionDropdown${this.sectionName}`);
        this.subsectionsContainer = this.row.getByTestId('permissionSubsections');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Get the current permission value (e.g., "Can edit", "Read only", "No access", "Mixed access")
     */
    async getPermissionValue(): Promise<string> {
        return (await this.dropdownButton.getByTestId('permissionSectionDropdownText').textContent()) ?? '';
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
        const menuItem = menuWrapper.getByRole('listitem').filter({hasText: permission});
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

class PermissionSubsection extends BaseComponent {
    readonly title: Locator;
    readonly description: Locator;
    readonly dropdownButton: Locator;

    private readonly sectionName: string;

    constructor(panelContainer: Locator, testId: string) {
        super(panelContainer.getByTestId(testId));
        this.title = this.container.getByTestId('permissionSectionTitle');
        this.description = this.container.getByTestId('permissionSectionDescription');
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
        return (await this.dropdownButton.getByTestId('permissionSectionDropdownText').textContent()) ?? '';
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
        const menuItem = menuWrapper.getByRole('listitem').filter({hasText: permission});
        await expect(menuItem).toBeVisible();
        await menuItem.click();

        // Wait for menu to close
        await expect(menuWrapper).not.toHaveClass(/MenuWrapper--open/);
    }
}

class AssignedPeoplePanel extends BaseComponent {
    readonly title: Locator;
    readonly description: Locator;
    readonly addPeopleButton: Locator;
    readonly searchInput: Locator;
    readonly userRows: Locator;
    readonly paginationInfo: Locator;
    readonly previousPageButton: Locator;
    readonly nextPageButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.title = container.getByRole('heading', {name: en['admin.permissions.system_role_users.title']});
        this.description = container.getByText(en['admin.permissions.system_role_users.description']);
        this.addPeopleButton = container.getByRole('button', {
            name: en['admin.permissions.system_role_users.add_people'],
        });
        this.searchInput = container.getByTestId('searchInput');
        this.userRows = container.getByTestId('dataGridRows').getByTestId('dataGridRow');
        this.paginationInfo = container.getByTestId('dataGridPaginationInfo');
        this.previousPageButton = container.getByTestId('dataGridPrev');
        this.nextPageButton = container.getByTestId('dataGridNext');
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

class AssignedUserRow extends BaseComponent {
    readonly avatar: Locator;
    readonly name: Locator;
    readonly email: Locator;
    readonly removeLink: Locator;

    constructor(container: Locator) {
        super(container);
        this.avatar = container.getByTestId('userGridAvatar');
        this.name = container.getByTestId('userGridNameText');
        this.email = container.getByTestId('userGridEmail');
        this.removeLink = container.getByRole('button', {name: en['admin.user_grid.remove']});
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
