// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class AddPeopleToChannelModal {
    readonly container: Locator;

    readonly closeButton;
    readonly cancelButton;
    readonly addButton;
    readonly alreadyInChannelLabel;
    readonly searchInput;
    readonly selectedRow;
    readonly selectedAvatar;
    readonly srOnlyRegion;
    readonly noResultsWrapper;
    readonly noResultsMessage;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel', exact: true});
        this.addButton = container.getByRole('button', {name: 'Add', exact: true});
        this.alreadyInChannelLabel = container.getByText('Already in channel');
        this.searchInput = container.getByRole('combobox', {name: 'Search for people or groups'});
        this.selectedRow = container.getByTestId('multiSelectListItemSelected');
        this.selectedAvatar = this.selectedRow.getByRole('img', {name: 'user profile image'});
        this.srOnlyRegion = container.getByTestId('multiSelectSelectionStatus');
        this.noResultsWrapper = container.getByTestId('multiSelectWrapper');
        this.noResultsMessage = container.getByTestId('multiSelectNoResultsMessage');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getHeading(channelDisplayName: string) {
        return this.container.getByRole('heading', {name: `Add people to ${channelDisplayName}`});
    }

    /**
     * Types into the auto-focused react-select search input. The input is not a
     * standard textbox, so type via the keyboard once the modal is visible.
     */
    async search(text: string) {
        await this.toBeVisible();
        await this.container.page().keyboard.type(text);
    }
}
