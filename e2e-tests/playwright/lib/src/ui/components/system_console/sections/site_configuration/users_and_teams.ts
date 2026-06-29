// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import {RadioSetting} from '../../base_components';

/**
 * System Console -> Site Configuration -> Users and Teams
 */
export default class UsersAndTeams extends BaseComponent {
    readonly header: Locator;
    readonly useAnonymousURLs: RadioSetting;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.header = container.getByText(en['admin.site.usersAndTeams'], {exact: true});
        this.useAnonymousURLs = new RadioSetting(container.getByTestId('PrivacySettings.UseAnonymousURLs'));
        this.saveButton = container.getByRole('button', {name: en['save_button.save']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async save() {
        await this.saveButton.click();
    }
}
