// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import {RadioSetting} from '../../base_components';

/**
 * System Console -> Site Configuration -> Users and Teams
 */
export default class UsersAndTeams {
    readonly container: Locator;

    readonly header: Locator;
    readonly useSecureURLs: RadioSetting;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.header = container.getByText('Users and Teams', {exact: true});
        this.useSecureURLs = new RadioSetting(container.getByRole('group', {name: /Use secure channel and team URLs/}));
        this.saveButton = container.getByRole('button', {name: 'Save'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.header).toBeVisible();
    }

    async save() {
        await this.saveButton.click();
    }
}
