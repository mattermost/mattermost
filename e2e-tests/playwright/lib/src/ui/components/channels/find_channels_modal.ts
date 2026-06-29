// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class FindChannelsModal extends BaseComponent {
    readonly input;
    readonly searchList;

    constructor(container: Locator) {
        super(container);

        this.input = container.getByRole('combobox', {name: en['quick_switch_modal.input']});
        this.searchList = container.getByRole('option');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getResult(channelName: string) {
        return this.container.getByTestId(channelName);
    }

    async selectChannel(channelName: string) {
        await this.getResult(channelName).click();
    }
}
