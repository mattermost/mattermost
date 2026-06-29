// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class SearchBox extends BaseComponent {
    readonly messagesButton;
    readonly filesButton;
    readonly searchInput;
    readonly searchBoxClose;
    readonly selectedSuggestion;
    readonly searchHints;
    readonly clearButton;
    readonly searchResultsContainer: Locator;
    readonly popoutButton: Locator;
    readonly teamSelectorContainer: Locator;
    readonly teamSelectorButton: Locator;
    readonly searchTeamSelector: Locator;
    readonly sbrSearchBox: Locator;
    readonly mobileNavbarSearchButton: Locator;
    readonly searchTypeBadge: Locator;

    constructor(container: Locator) {
        super(container);

        this.messagesButton = container.getByRole('button', {name: en['search_bar.messages_tab']});
        this.filesButton = container.getByRole('button', {name: en['search_bar.files_tab']});
        this.searchInput = container.getByLabel(en['search_bar.search_messages']);
        this.searchBoxClose = container.getByTestId('searchBoxClose');
        this.selectedSuggestion = container.getByTestId('selectedSuggestion').getByTestId('suggestionMain');
        this.searchHints = container.locator('#searchHints');
        this.clearButton = container.getByRole('button', {name: en['search_bar.clear']});

        const page = container.page();
        this.searchResultsContainer = page.locator('#searchContainer');
        this.popoutButton = this.searchResultsContainer.getByRole('button', {name: en['new_window_button.tooltip']});
        this.teamSelectorContainer = this.searchResultsContainer.getByTestId('teamSelectorContainer');
        this.teamSelectorButton = this.teamSelectorContainer.getByTestId('searchTeamsSelectorMenuButton');
        this.searchTeamSelector = container.getByTestId('searchTeamSelector');
        this.sbrSearchBox = page.locator('#sbrSearchBox');
        this.mobileNavbarSearchButton = page
            .locator('#navbar')
            .getByRole('button', {name: en['search_bar.search'], exact: true});
        this.searchTypeBadge = page.getByTestId('searchTypeBadge');
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
        return this.searchHints.getByTestId('selectedSuggestion');
    }
}
