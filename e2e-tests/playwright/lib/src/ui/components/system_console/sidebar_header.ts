// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import AboutBuildModal from '@/ui/components/about_build_modal';

/**
 * System Console Sidebar Header component
 */
export default class SystemConsoleSidebarHeader {
    readonly container: Locator;
    readonly headerInfo: Locator;
    readonly title: Locator;
    readonly userName: Locator;
    readonly menuButton: Locator;
    readonly aboutMenuItem: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.headerInfo = container.getByTestId('admin-sidebar-header-info');
        this.title = container.getByText('System Console');
        this.userName = container.getByText(/^@/);
        this.menuButton = container.getByRole('button', {name: 'Menu Icon'});

        // Rendered in a portal at the page level once the menu is open.
        this.aboutMenuItem = container.page().getByRole('menuitem', {name: /^About /});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.title).toBeVisible();
    }

    /**
     * Opens the sidebar header's menu and selects "About {siteName}", returning the modal.
     */
    async openAbout(): Promise<AboutBuildModal> {
        await this.menuButton.click();
        await this.aboutMenuItem.click();

        const aboutModal = new AboutBuildModal(this.container.page().getByRole('dialog', {name: /^About /}));
        await aboutModal.toBeVisible();
        return aboutModal;
    }
}
