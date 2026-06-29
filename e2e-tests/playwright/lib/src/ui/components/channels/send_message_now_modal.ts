// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class SendMessageNowModal extends BaseComponent {
    readonly body: Locator;
    readonly sendNowButton: Locator;
    readonly cancelButton: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.body = container.getByTestId('sendNowModalBody');
        this.sendNowButton = container.getByRole('button', {name: en['drafts.confirm.send.button']});
        this.cancelButton = container.getByRole('button', {name: en['generic_btn.cancel']});
        this.closeButton = container.getByRole('button', {name: en['generic.close']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
