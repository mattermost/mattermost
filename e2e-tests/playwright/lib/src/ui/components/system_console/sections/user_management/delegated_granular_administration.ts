// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import SystemRoles from './system_roles';

/**
 * System Console -> User Management -> Delegated Granular Administration
 */
export default class DelegatedGranularAdministration extends BaseComponent {
    readonly header: Locator;

    // Admin Roles Panel
    readonly adminRolesPanel: AdminRolesPanel;

    // System Roles page (accessed by clicking Edit on a role row)
    readonly systemRoles: SystemRoles;

    constructor(container: Locator) {
        super(container);
        this.header = container.getByText(en['admin.permissions.systemRoles'], {exact: true});

        this.adminRolesPanel = new AdminRolesPanel(container.locator('#SystemRoles'));

        // System Roles page (click Edit on a role to navigate here)
        this.systemRoles = new SystemRoles(container);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }
}

class AdminRolesPanel extends BaseComponent {
    readonly title: Locator;
    readonly description: Locator;
    private readonly dataGrid: DataGrid;

    constructor(container: Locator) {
        super(container);
        this.title = container.getByRole('heading', {name: en['admin.permissions.systemRolesBannerTitle']});
        this.description = container.getByText(en['admin.permissions.systemRolesBannerText']);
        this.dataGrid = new DataGrid(container.getByTestId('dataGrid'));
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
    get sharedChannelManager() {
        return this.dataGrid.sharedChannelManager;
    }
    get viewer() {
        return this.dataGrid.viewer;
    }
}

class DataGrid extends BaseComponent {
    readonly header: Locator;
    readonly rows: Locator;

    // Role rows
    readonly systemAdmin: RoleRow;
    readonly systemManager: RoleRow;
    readonly userManager: RoleRow;
    readonly customGroupManager: RoleRow;
    readonly sharedChannelManager: RoleRow;
    readonly viewer: RoleRow;

    constructor(container: Locator) {
        super(container);
        this.header = container.getByTestId('dataGridHeader');
        this.rows = container.getByTestId('dataGridRows');

        // Individual role rows
        this.systemAdmin = new RoleRow(
            this.rows.getByTestId('dataGridRow').filter({hasText: 'System Admin'}),
            'system_admin_edit',
        );
        this.systemManager = new RoleRow(
            this.rows.getByTestId('dataGridRow').filter({hasText: 'System Manager'}),
            'system_manager_edit',
        );
        this.userManager = new RoleRow(
            this.rows.getByTestId('dataGridRow').filter({hasText: 'User Manager'}),
            'system_user_manager_edit',
        );
        this.customGroupManager = new RoleRow(
            this.rows.getByTestId('dataGridRow').filter({hasText: 'Custom Group Manager'}),
            'system_custom_group_admin_edit',
        );
        this.sharedChannelManager = new RoleRow(
            this.rows.getByTestId('dataGridRow').filter({hasText: 'Shared Channel Manager'}),
            'system_shared_channel_manager_edit',
        );
        this.viewer = new RoleRow(
            this.rows.getByTestId('dataGridRow').filter({hasText: 'Viewer'}),
            'system_read_only_admin_edit',
        );
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

class RoleRow extends BaseComponent {
    readonly roleName: Locator;
    readonly description: Locator;
    readonly type: Locator;
    readonly editLink: Locator;

    constructor(container: Locator, editTestId: string) {
        super(container);

        const cells = container.getByTestId('dataGridCell');
        this.roleName = cells.nth(0);
        this.description = cells.nth(1);
        this.type = cells.nth(2);
        this.editLink = container.getByTestId(editTestId).getByRole('link', {name: en['admin.permissions.roles.edit']});
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
