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
    readonly filesTab: Locator;
    readonly channelFilesRegion: Locator;
    readonly filesFilterButton: Locator;
    readonly filesFilterMenu: Locator;
    readonly noFilesFound: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.filesTab = container.getByRole('tab', {name: /^Files/});
        this.channelFilesRegion = container.getByRole('region', {name: /^Files /});
        this.filesFilterButton = container
            .getByRole('button', {name: 'Filter'})
            .or(container.locator('#filesFilterButton'));
        const namedFilesFilterMenu = container.page().getByRole('menu', {name: 'file menu'});
        const unnamedFilesFilterMenu = container
            .page()
            .getByRole('menu')
            .filter({has: container.page().getByRole('menuitem', {name: 'Documents'})});
        this.filesFilterMenu = namedFilesFilterMenu.or(unnamedFilesFilterMenu);
        this.noFilesFound = container.getByText('No files found', {exact: true});
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

    getFileResultItems() {
        return this.getResultItems();
    }

    async toHaveFiles(files: string[]) {
        const items = this.getFileResultItems();
        await expect(items).toHaveCount(files.length);
        for (const [index, file] of files.entries()) {
            await expect(items.nth(index).getByText(file, {exact: true})).toBeVisible();
        }
    }

    async filterFilesBy(option: string) {
        await this.filesFilterButton.click();
        await this.filesFilterMenu.getByRole('menuitem', {name: option, exact: true}).click();
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
     * Hovers the result item that contains the given text and opens its "more" (dot) menu.
     */
    async openResultDotMenu(text: string) {
        const item = this.getResultByText(text).first();
        await item.hover();
        await item.getByRole('button', {name: 'more'}).click();
    }

    getAddReactionButton(text: string) {
        return this.getResultByText(text).first().getByRole('button', {name: 'Add Reaction'});
    }

    /**
     * Clicks the "Jump" link on the result item that contains the given text.
     */
    async jumpToResultWithText(text: string) {
        await this.getResultByText(text).first().getByRole('link', {name: 'Jump'}).click();
    }
}
