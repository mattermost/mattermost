// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';
import {components} from '../components';

class SystemConsolePage {
    readonly page: Page;

    readonly sidebar;
    readonly navbar;

    /**
     * System Console -> User Management -> Users
     */
    readonly systemUsers;
    readonly systemUsersFilterPopover;
    readonly systemUsersRoleMenu;
    readonly systemUsersStatusMenu;
    readonly systemUsersDateRangeMenu;
    readonly systemUsersColumnToggleMenu;
    readonly systemUsersActionMenus;

    // modal
    readonly confirmModal;
    readonly exportModal;
    readonly saveChangesModal;

    constructor(page: Page) {
        this.page = page;

        // Areas of the page
        this.navbar = new components.SystemConsoleNavbar(page.locator('.backstage-navbar'));
        this.sidebar = new components.SystemConsoleSidebar(page.locator('.admin-sidebar'));

        // Sections and sub-sections
        this.systemUsers = new components.SystemUsers(page.getByTestId('systemUsersSection'));

        // Menus & Popovers
        this.systemUsersFilterPopover = new components.SystemUsersFilterPopover(
            page.locator('#systemUsersFilterPopover'),
        );
        this.systemUsersRoleMenu = new components.SystemUsersFilterMenu(page.locator('#DropdownInput_filterRole'));
        this.systemUsersStatusMenu = new components.SystemUsersFilterMenu(page.locator('#DropdownInput_filterStatus'));
        this.systemUsersColumnToggleMenu = new components.SystemUsersColumnToggleMenu(
            page.locator('#systemUsersColumnTogglerMenu'),
        );
        this.systemUsersDateRangeMenu = new components.SystemUsersFilterMenu(
            page.locator('#systemUsersDateRangeSelectorMenu'),
        );
        this.systemUsersActionMenus = Array.from(Array(10).keys()).map(
            (index) => new components.SystemUsersFilterMenu(page.locator(`#actionMenu-systemUsersTable-${index}`)),
        );

        this.confirmModal = new components.GenericConfirmModal(page.locator('#confirmModal'));
        this.exportModal = new components.GenericConfirmModal(page.getByRole('dialog', {name: 'Export user data'}));
        this.saveChangesModal = new components.SystemUsers(page.locator('div.modal-content'));
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');

        await this.sidebar.toBeVisible();
        await this.navbar.toBeVisible();
    }

    async goto() {
        await this.page.goto('/admin_console');
    }

    async saveRoleChange() {
        await this.saveChangesModal.container.locator('button.btn-primary:has-text("Save")').click();
    }

    async clickResetButton() {
        await this.saveChangesModal.container.locator('button.btn-primary:has-text("Reset")').click();
    }
}

export {SystemConsolePage};
