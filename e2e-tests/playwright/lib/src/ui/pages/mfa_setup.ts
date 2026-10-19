// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class MfaSetupPage {
    readonly page: Page;
    readonly title: ReturnType<Page['getByText']>;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByText('Multi-factor Authentication Setup', {exact: true});
    }

    async toBeVisible() {
        await expect(this.title).toBeVisible();
    }

    async toBeHidden() {
        await expect(this.title).toBeHidden();
    }
}
