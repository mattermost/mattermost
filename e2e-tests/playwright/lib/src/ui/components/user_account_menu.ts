// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class UserAccountMenu {
    readonly container: Locator;

    readonly setCustomStatus;
    readonly online;
    readonly away;
    readonly dnd;
    readonly offline;
    readonly profile;
    readonly logout;

    constructor(container: Locator) {
        this.container = container;

        this.setCustomStatus = container.getByRole('button', {name: 'Set custom status'});
        this.online = container.getByRole('menuitem', {name: 'Online'});
        this.away = container.getByRole('menuitem', {name: 'Away'});
        this.dnd = container.locator('[id="userAccountMenu\\.dndMenuItem"]');
        this.offline = container.getByRole('menuitem', {name: 'Offline'});
        this.profile = container.getByRole('menuitem', {name: 'Profile'});
        this.logout = container.getByRole('menuitem', {name: 'Log out'});
    }

    async toBeVisible(name: string) {
        await expect(this.container.getByRole('heading', {name})).toBeVisible();
    }
}
