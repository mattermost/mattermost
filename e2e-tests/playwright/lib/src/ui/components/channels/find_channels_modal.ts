// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class FindChannelsModal {
    readonly container: Locator;
    readonly input;
    readonly searchList;

    constructor(container: Locator) {
        this.container = container;

        this.input = container.getByRole('combobox', {name: 'quick switch input'});
        this.searchList = container.getByRole('option');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getResult(channelName: string) {
        return this.container.getByTestId(channelName);
    }

    getOption(name: string | RegExp) {
        return this.container.getByRole('option', {name, exact: typeof name === 'string'});
    }

    getDirectMessageOption(username: string, excludedUsername?: string) {
        let option = this.searchList.filter({hasText: `@${username}`});
        if (excludedUsername) {
            option = option.filter({hasNotText: excludedUsername});
        }
        return option.first();
    }

    getGroupMessageOption(usernames: string[]) {
        return usernames.reduce((options, username) => options.filter({hasText: username}), this.searchList).first();
    }

    async toHaveOptionSelected(name: string, unreadDescription?: RegExp) {
        const option = this.getOption(name);
        await expect(option).toHaveClass(/suggestion--selected/);
        if (unreadDescription) {
            await expect(option).toHaveAccessibleDescription(unreadDescription);
        }
    }

    async selectChannel(channelName: string) {
        await this.getResult(channelName).click();
    }
}
