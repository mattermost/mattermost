// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

/**
 * System Console -> Authentication -> SAML 2.0.
 */
export default class Saml {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/admin_console/authentication/saml');
        await expect(this.page.getByRole('group', {name: 'Enable Login With SAML 2.0:', exact: true})).toBeVisible({
            timeout: duration.half_min,
        });
    }
}
