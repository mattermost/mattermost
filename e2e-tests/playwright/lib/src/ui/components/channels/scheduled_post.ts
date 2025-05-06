// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

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

        this.panelHeader = container.locator('.PanelHeader');
        this.panelBody = container.locator('.DraftPanelBody');

        this.postBody = container.locator('.post__body');
        this.postHeader = container.locator('.post__header');
        this.postImage = container.locator('.post__img');

        this.deleteButton = container.locator('#draft_icon-trash-can-outline_delete');
        this.editButton = container.locator('#draft_icon-pencil-outline_edit');
        this.copyTextButton = container.locator('#draft_icon-content-copy_copy_text');
        this.rescheduleButton = container.locator('#draft_icon-clock-send-outline_reschedule');
        this.sendNowButton = container.locator('#draft_icon-send-outline_sendNow');

        this.editTextBox = container.getByTestId('edit_textbox');
        this.saveButton = container.locator('button:has-text("Save")');
        this.cancelButton = container.locator('button:has-text("Cancel")');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async hover() {
        await this.container.hover();
    }
}
