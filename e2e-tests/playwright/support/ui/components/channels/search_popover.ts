// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class SearchPopover {
    readonly container: Locator;

    readonly messagesButton;
    readonly filesButton;
    readonly searchInput;
    readonly searchBoxClose;
    readonly selectedSuggestion;
    readonly searchHints;

    constructor(container: Locator) {
        this.container = container;

        this.messagesButton = container.getByRole('button', {name: 'Messages'});
        this.filesButton = container.getByRole('button', {name: 'Files'});
        this.searchInput = container.getByLabel('Search messages');
        this.searchBoxClose = container.getByTestId('searchBoxClose');
        this.selectedSuggestion = container.locator('.suggestion--selected').locator('.suggestion-list__main');
        this.searchHints = container.locator('#searchHints');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getSelectedSuggestion() {
        return this.searchHints.locator('.suggestion--selected');
    }
}

export {SearchPopover};
