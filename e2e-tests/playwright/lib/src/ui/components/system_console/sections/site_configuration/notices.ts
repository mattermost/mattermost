// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {RadioSetting} from '../../base_components';

/**
 * System Console -> Site Configuration -> Notices
 */
export default class Notices {
    readonly container: Locator;

    readonly header: Locator;

    readonly enableAdminNotices: RadioSetting;
    readonly enableEndUserNotices: RadioSetting;
    readonly checkForSecurityAndReleaseUpdates: RadioSetting;

    constructor(container: Locator) {
        this.container = container;

        this.header = container.getByText('Notices', {exact: true});

        this.enableAdminNotices = new RadioSetting(container.getByRole('group', {name: /Enable Admin Notices/}));
        this.enableEndUserNotices = new RadioSetting(container.getByRole('group', {name: /Enable End User Notices/}));
        this.checkForSecurityAndReleaseUpdates = new RadioSetting(
            container.getByRole('group', {name: /Check for Security and Release Updates/}),
            'ServiceSettings.EnableSecurityFixAlert',
        );
    }

    async toBeVisible() {
        await expect(this.header).toBeVisible();
        await this.enableAdminNotices.toBeVisible();
    }
}
