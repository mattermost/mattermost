// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class DeleteScheduledPostModal extends BaseComponent {
    readonly body: Locator;
    readonly deleteButton: Locator;
    readonly cancelButton: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.body = container.getByTestId('deleteScheduledPostModalBody');
        this.deleteButton = container.getByRole('button', {name: en['drafts.confirm.delete.button']});
        this.cancelButton = container.getByRole('button', {name: en['generic_modal.cancel']});
        this.closeButton = container.getByRole('button', {name: en['generic.close']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
