// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class SearchTeamSelector {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    get container() {
        return this.page.getByTestId('searchTeamSelector');
    }

    get menuButton() {
        return this.page.getByTestId('searchTeamsSelectorMenuButton');
    }

    get resultsMenuButton() {
        return this.page.locator('#searchContainer').getByTestId('searchTeamsSelectorMenuButton');
    }

    get resultsContainer() {
        return this.page.locator('#searchContainer').getByTestId('searchResultsTeamSelector');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getTeamMenu() {
        return this.page.getByRole('menu', {name: 'Select team'});
    }
}
