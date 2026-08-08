// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

/**
 * Channel selector multi-select modal ("Add Channels to Channel Selection List").
 * Used from System Console policy editors and Team Settings policy editor.
 * Obtain via SystemConsolePage.getChannelSelectorModal() or ChannelsPage.getChannelSelectorModal().
 */
export default class ChannelSelectorModal {
    readonly container: Locator;

    readonly addButton: Locator;
    readonly closeButton: Locator;
    readonly searchInput: Locator;
    readonly selectChannelButton: Locator;
    readonly listItems: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.addButton = container.getByRole('button', {name: 'Add', exact: true});
        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.searchInput = container.getByRole('combobox', {name: 'Search and add channels'});
        this.selectChannelButton = container.getByRole('button', {name: /select channel/i});
        this.listItems = container.getByTestId(/multiSelectListItem/);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeHidden(timeout = duration.ten_sec) {
        await expect(this.container).not.toBeVisible({timeout});
    }

    channelRow(displayName: string): Locator {
        return this.listItems.filter({hasText: displayName});
    }
}
