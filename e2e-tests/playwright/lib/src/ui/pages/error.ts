// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ErrorPage {
    readonly page: Page;
    readonly title;
    readonly backLink;
    readonly userNotRegisteredOnLdap;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByRole('heading', {name: 'Error'});
        this.backLink = page.getByRole('link', {name: 'Back to Mattermost'});
        this.userNotRegisteredOnLdap = page.getByText(
            'No user registered on AD/LDAP server that matches the SAML user.',
        );
    }

    async toBeVisible() {
        await expect(this.title).toBeVisible();
    }
}
