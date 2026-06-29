// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * System Console Sidebar Header component
 */
export default class SystemConsoleSidebarHeader extends BaseComponent {
    readonly headerInfo: Locator;
    readonly title: Locator;
    readonly userName: Locator;
    readonly menuButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.headerInfo = container.getByTestId('adminSidebarHeaderInfo');
        this.title = container.getByText(en['admin.sidebarHeader.systemConsole']);
        this.userName = container.getByTestId('adminSidebarHeaderUsername');
        this.menuButton = container.getByRole('button', {name: en['generic_icons.menu']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.title).toBeVisible();
    }
}
