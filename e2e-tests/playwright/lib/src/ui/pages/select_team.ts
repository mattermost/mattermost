// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class SelectTeamPage {
    readonly page: Page;
    readonly title: ReturnType<Page['getByText']>;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByText('Teams you can join:');
    }

    async toBeVisible() {
        await expect(this.title).toBeVisible();
    }
}
