// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ScheduledPost {
    readonly container: Locator;

    readonly panelHeader;
    readonly panelBody;

    readonly postBody;
    readonly postHeader;
    readonly postImage;

    readonly deleteButton;
    readonly editButton;
    readonly copyTextButton;
    readonly rescheduleButton;
    readonly sendNowButton;

    readonly editTextBox;
    readonly saveButton;
    readonly cancelButton;

    constructor(container: Locator) {
        this.container = container;

        this.panelHeader = container.getByTestId('draft-panel-header');
        this.panelBody = container.getByTestId('draft-panel-body');

        this.postBody = container.getByTestId('draft-post-body');
        this.postHeader = container.getByTestId('draft-post-header');
        this.postImage = container.getByTestId('draft-post-img');

        this.deleteButton = container.locator('#draft_icon-trash-can-outline_delete');
        this.editButton = container.locator('#draft_icon-pencil-outline_edit');
        this.copyTextButton = container.locator('#draft_icon-content-copy_copy_text');
        this.rescheduleButton = container.locator('#draft_icon-clock-send-outline_reschedule');
        this.sendNowButton = container.locator('#draft_icon-send-outline_sendNow');

        this.editTextBox = container.getByTestId('edit_textbox');
        this.saveButton = container.getByRole('button', {name: 'Save'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async hover() {
        await this.container.hover();
    }
}
