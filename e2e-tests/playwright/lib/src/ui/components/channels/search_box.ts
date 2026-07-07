// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class SearchBox {
    readonly container: Locator;

    readonly messagesButton;
    readonly filesButton;
    readonly searchInput;
    readonly searchBoxClose;
    readonly selectedSuggestion;
    readonly searchHints;
    readonly clearButton;

    constructor(container: Locator) {
        this.container = container;

        this.messagesButton = container.getByRole('button', {name: 'Messages'});
        this.filesButton = container.getByRole('button', {name: 'Files'});
        this.searchInput = container.getByLabel('Search messages');
        this.searchBoxClose = container.getByTestId('searchBoxClose');
        this.selectedSuggestion = container.getByTestId('suggestion-selected').getByTestId('suggestion-list__main');
        this.searchHints = container.locator('#searchHints');
        this.clearButton = container.getByTestId('input-clear');
    }

    // clearIfPossible clears the search input if the clear button is visible. Returns true if the clear button was clicked.
    async clearIfPossible() {
        if (await this.clearButton.isVisible()) {
            await this.clearButton.click();
            await expect(this.searchInput).toHaveValue('');
            return true;
        }
        return false;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getSelectedSuggestion() {
        return this.searchHints.getByTestId('suggestion-selected');
    }
}
