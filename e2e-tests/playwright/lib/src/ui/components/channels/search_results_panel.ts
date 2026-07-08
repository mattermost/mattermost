// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The right-hand-side panel that renders search results, saved messages, and
 * recent mentions. All three share the `#searchContainer` region.
 */
export default class SearchResultsPanel {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    async toHaveHeading(name: string) {
        await expect(this.container.getByRole('heading', {name})).toBeVisible();
    }

    /**
     * All result items currently shown in the panel.
     */
    getResultItems() {
        return this.container.getByTestId('search-item-container');
    }

    /**
     * A single result item that contains the given text.
     */
    getResultByText(text: string) {
        return this.getResultItems().filter({hasText: text});
    }

    /**
     * All highlighted search terms currently rendered in the panel.
     */
    getHighlightedTerms() {
        return this.container.getByTestId('search-highlight');
    }

    async toContainText(text: string) {
        await expect(this.container).toContainText(text);
    }

    /**
     * Clicks the reply (comment) arrow on the result item that contains the given text.
     */
    async replyToResultWithText(text: string) {
        const item = this.getResultByText(text).first();
        await item.hover();
        await item.getByRole('button', {name: 'reply'}).click();
    }

    /**
     * Clicks the "Jump" link on the result item that contains the given text.
     */
    async jumpToResultWithText(text: string) {
        await this.getResultByText(text).first().getByRole('link', {name: 'Jump'}).click();
    }
}
