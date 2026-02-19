// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import SystemRoles from './system_roles';

/**
 * System Console -> User Management -> Delegated Granular Administration
 */
export default class DelegatedGranularAdministration {
    readonly container: Locator;
    readonly header: Locator;

    // Admin Roles Panel
    readonly adminRolesPanel: AdminRolesPanel;

    // System Roles page (accessed by clicking Edit on a role row)
    readonly systemRoles: SystemRoles;

    constructor(container: Locator) {
        this.container = container;
        this.header = container.getByText('Delegated Granular Administration', {exact: true});

        this.adminRolesPanel = new AdminRolesPanel(container.locator('#SystemRoles'));

        // System Roles page (click Edit on a role to navigate here)
        this.systemRoles = new SystemRoles(container);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }
}

class AdminRolesPanel {
    readonly container: Locator;
    readonly title: Locator;
    readonly description: Locator;
    private readonly dataGrid: DataGrid;

    constructor(container: Locator) {
        this.container = container;
        this.title = container.getByRole('heading', {name: 'Admin Roles'});
        this.description = container.getByText('Manage different levels of access to the system console.');
        this.dataGrid = new DataGrid(container.locator('.DataGrid'));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.title).toBeVisible();
    }

    // Shortcuts to role rows
    get systemAdmin() {
        return this.dataGrid.systemAdmin;
    }
    get systemManager() {
        return this.dataGrid.systemManager;
    }
    get userManager() {
        return this.dataGrid.userManager;
    }
    get customGroupManager() {
        return this.dataGrid.customGroupManager;
    }
    get viewer() {
        return this.dataGrid.viewer;
    }
}

class DataGrid {
    readonly container: Locator;
    readonly header: Locator;
    readonly rows: Locator;

    // Role rows
    readonly systemAdmin: RoleRow;
    readonly systemManager: RoleRow;
    readonly userManager: RoleRow;
    readonly customGroupManager: RoleRow;
    readonly viewer: RoleRow;

    constructor(container: Locator) {
        this.container = container;
        this.header = container.locator('.DataGrid_header');
        this.rows = container.locator('.DataGrid_rows');

        // Individual role rows
        this.systemAdmin = new RoleRow(
            this.rows.locator('.DataGrid_row').filter({hasText: 'System Admin'}),
            'system_admin_edit',
        );
        this.systemManager = new RoleRow(
            this.rows.locator('.DataGrid_row').filter({hasText: 'System Manager'}),
            'system_manager_edit',
        );
        this.userManager = new RoleRow(
            this.rows.locator('.DataGrid_row').filter({hasText: 'User Manager'}),
            'system_user_manager_edit',
        );
        this.customGroupManager = new RoleRow(
            this.rows.locator('.DataGrid_row').filter({hasText: 'Custom Group Manager'}),
            'system_custom_group_admin_edit',
        );
        this.viewer = new RoleRow(
            this.rows.locator('.DataGrid_row').filter({hasText: 'Viewer'}),
            'system_read_only_admin_edit',
        );
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

class RoleRow {
    readonly container: Locator;
    readonly roleName: Locator;
    readonly description: Locator;
    readonly type: Locator;
    readonly editLink: Locator;

    constructor(container: Locator, editTestId: string) {
        this.container = container;

        const cells = container.locator('.DataGrid_cell');
        this.roleName = cells.nth(0);
        this.description = cells.nth(1);
        this.type = cells.nth(2);
        this.editLink = container.getByTestId(editTestId).getByRole('link', {name: 'Edit'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async clickEdit() {
        await this.editLink.click();
    }

    async getRoleName(): Promise<string> {
        return (await this.roleName.textContent()) ?? '';
    }

    async getDescription(): Promise<string> {
        return (await this.description.textContent()) ?? '';
    }

    async getType(): Promise<string> {
        return (await this.type.textContent()) ?? '';
    }
}
