// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {BaseComponent} from '@/ui/base_component';

export default class ChannelSearchResults extends BaseComponent {
    readonly messagesTab: Locator;
    readonly filesTab: Locator;
    readonly closeButton: Locator;
    readonly resultsContainer: Locator;

    constructor(container: Locator) {
        super(container);

        this.messagesTab = container.getByRole('tab', {name: en['search_bar.messages_tab']});
        this.filesTab = container.getByRole('tab', {name: en['search_bar.files_tab']});
        this.closeButton = container.locator('#searchResultsCloseButton');
        this.resultsContainer = container.locator('#search-items-container');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    getSearchResultItem(index: number): Locator {
        return this.resultsContainer.getByTestId('search-item-container').nth(index);
    }
}
