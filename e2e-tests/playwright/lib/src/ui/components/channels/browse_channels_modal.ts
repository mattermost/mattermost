// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class BrowseChannelsModal extends BaseComponent {
    readonly createNewChannelButton: Locator;
    readonly hideJoinedCheckbox: Locator;
    readonly searchInput: Locator;

    readonly results: Locator;
    readonly channelTypeFilterButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.createNewChannelButton = container.getByRole('button', {name: en['more_channels.create']});
        this.hideJoinedCheckbox = container.getByRole('checkbox', {name: en['more_channels.hide_joined']});
        this.searchInput = container.getByRole('textbox', {name: en['filtered_channels_list.search']});

        this.results = this.container.getByRole('search');
        this.channelTypeFilterButton = container.locator('#menuWrapper');
    }

    get channelsMoreDropdownRecommended(): Locator {
        return this.container.page().locator('#channelsMoreDropdownRecommended');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeDoneLoading() {
        await expect(this.container.getByTestId('loadingScreen')).toHaveCount(0);
    }

    async toHaveNResults(count: number) {
        await expect(this.results.locator('[data-testid^="ChannelRow-"]')).toHaveCount(count);
    }

    async fillSearchInput(text: string) {
        await this.searchInput.fill(text);
    }

    async toHaveChannelAsNthResult(channelName: string, index: number) {
        const row = this.results.locator('[data-testid^="ChannelRow-"]').nth(index);

        expect(await row.getAttribute('data-testid')).toEqual(`ChannelRow-${channelName}`);
    }

    getChannelRowByName(channelName: string): Locator {
        return this.results.getByTestId(`ChannelRow-${channelName}`);
    }
}
