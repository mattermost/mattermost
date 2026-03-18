// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class BrowseChannelsModal {
    readonly container: Locator;

    readonly createNewChannelButton: Locator;
    readonly hideJoinedCheckbox: Locator;
    readonly searchInput: Locator;

    readonly results: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.createNewChannelButton = container.getByRole('button', {name: 'Create New Channel'});
        this.hideJoinedCheckbox = container.getByRole('checkbox', {name: 'Hide Joined'});
        this.searchInput = container.getByRole('textbox', {name: 'Search channels'});

        // This role seems incorrect and will likely need to be changed later
        this.results = this.container.getByRole('search');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeDoneLoading() {
        await expect(this.container.locator('.loading-screen')).toHaveCount(0);
    }

    async toHaveNResults(count: number) {
        await expect(this.results.locator('.more-modal__row')).toHaveCount(count);
    }

    async fillSearchInput(text: string) {
        await this.searchInput.fill(text);
    }

    async toHaveChannelAsNthResult(channelName: string, index: number) {
        const row = this.results.locator('.more-modal__row').nth(index);

        expect(await row.getAttribute('data-testid')).toEqual(`ChannelRow-${channelName}`);
    }
}
