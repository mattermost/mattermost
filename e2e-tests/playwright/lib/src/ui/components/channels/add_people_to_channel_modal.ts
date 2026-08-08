// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class AddPeopleToChannelModal {
    readonly container: Locator;

    readonly closeButton;
    readonly alreadyInChannelLabel;
    readonly searchInput;
    readonly addButton;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.alreadyInChannelLabel = container.getByText('Already in channel');
        this.searchInput = container.getByRole('combobox', {name: 'Search for people or groups'});
        this.addButton = container.getByRole('button', {name: 'Add', exact: true});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Types into the auto-focused react-select search input. The input is not a
     * standard textbox, so type via the keyboard once the modal is visible.
     */
    async search(text: string) {
        await this.toBeVisible();
        await this.container.page().keyboard.type(text);
    }

    getUserOption(username: string) {
        return this.container.getByRole('option', {name: username, exact: true});
    }

    getUserProfileImage(username: string) {
        return this.getUserOption(username).getByRole('img', {name: 'user profile image'});
    }

    async selectUser(username: string) {
        await this.getUserOption(username).click();
    }

    async addSelected() {
        await this.addButton.click();
        await expect(this.container).not.toBeVisible();
    }
}
