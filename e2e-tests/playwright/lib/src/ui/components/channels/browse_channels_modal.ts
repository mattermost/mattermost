// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class BrowseChannelsModal {
    readonly container: Locator;

    readonly createNewChannelButton: Locator;
    readonly hideJoinedCheckbox: Locator;
    readonly searchInput: Locator;
    readonly channelTypeFilterButton: Locator;
    readonly archivedChannelsMenuItem: Locator;

    readonly results: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.createNewChannelButton = container.getByRole('button', {name: 'Create New Channel'});
        this.hideJoinedCheckbox = container.getByRole('checkbox', {name: 'Hide Joined'});
        this.searchInput = container.getByRole('textbox', {name: 'Search channels'});
        this.channelTypeFilterButton = container.getByRole('button', {name: 'Channel type filter'});
        this.archivedChannelsMenuItem = container.page().getByRole('menuitem', {name: 'Archived channels'});

        // This role seems incorrect and will likely need to be changed later
        this.results = this.container.getByRole('search');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeDoneLoading() {
        await expect(this.container.getByTestId('loading-screen')).toHaveCount(0);
    }

    async toHaveNResults(count: number) {
        await expect(this.results.locator('[data-testid^="ChannelRow-"]')).toHaveCount(count);
    }

    async fillSearchInput(text: string) {
        await this.searchInput.fill(text);
    }

    getChannel(channelDisplayName: string) {
        return this.results.getByText(channelDisplayName, {exact: true});
    }

    async filterByArchivedChannels() {
        await this.channelTypeFilterButton.click();
        await this.archivedChannelsMenuItem.click();
        await expect(this.channelTypeFilterButton).toContainText('Channel Type: Archived');
    }

    async toHaveChannelAsNthResult(channelName: string, index: number) {
        const row = this.results.locator('[data-testid^="ChannelRow-"]').nth(index);

        expect(await row.getAttribute('data-testid')).toEqual(`ChannelRow-${channelName}`);
    }
}
