// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class UserAccountMenu extends BaseComponent {
    readonly setCustomStatus;
    readonly online;
    readonly away;
    readonly dnd;
    readonly offline;
    readonly profile;
    readonly logout;

    constructor(container: Locator) {
        super(container);

        this.setCustomStatus = container.getByRole('button', {
            name: en['userAccountMenu.setCustomStatusMenuItem.noStatusSet'],
        });
        this.online = container.getByRole('menuitem', {name: en['userAccountMenu.onlineMenuItem.label']});
        this.away = container.getByRole('menuitem', {name: en['userAccountMenu.awayMenuItem.label']});
        this.dnd = container.locator('[id="userAccountMenu\\.dndMenuItem"]');
        this.offline = container.getByRole('menuitem', {name: en['userAccountMenu.offlineMenuItem.label']});
        this.profile = container.getByRole('menuitem', {name: en['userAccountMenu.profileMenuItem.label']});
        this.logout = container.getByRole('menuitem', {name: en['userAccountMenu.logoutMenuItem.label']});
    }

    async toBeVisible(name?: string) {
        if (name) {
            await expect(this.container.getByRole('heading', {name})).toBeVisible();
        } else {
            await expect(this.container).toBeVisible();
        }
    }
}
