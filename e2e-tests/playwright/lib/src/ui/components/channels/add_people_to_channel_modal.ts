// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class AddPeopleToChannelModal {
    readonly container: Locator;

    readonly closeButton;
    readonly alreadyInChannelLabel;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.alreadyInChannelLabel = container.getByText('Already in channel');
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
}
