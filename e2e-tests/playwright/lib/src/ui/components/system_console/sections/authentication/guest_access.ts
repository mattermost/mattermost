// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

/**
 * System Console -> Authentication -> Guest Access.
 */
export default class GuestAccess {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/admin_console/authentication/guest_access');
        await expect(this.page.getByRole('group', {name: 'Enable Guest Access:', exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }

    async setEnabled(enabled: boolean) {
        const radio = this.page.getByRole('radio', {name: enabled ? 'True' : 'False', exact: true}).first();
        if (await radio.isChecked()) {
            return;
        }

        await radio.check();
        const saveButton = this.page.getByRole('button', {name: 'Save', exact: true});
        await saveButton.click();
        if (!enabled) {
            await this.page
                .getByRole('dialog')
                .getByRole('button', {name: 'Save and Disable Guest Access', exact: true})
                .click();
        }
        await expect(saveButton).toBeDisabled({timeout: duration.half_min});
    }
}
