// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class ScheduledPost extends BaseComponent {
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
        super(container);

        this.panelHeader = container.getByTestId('panelHeader');
        this.panelBody = container.getByTestId('draftPanelBody');

        this.postBody = container.getByTestId('draftPanelBodyContent');
        this.postHeader = container.getByTestId('draftPanelBodyHeader');
        this.postImage = container.getByTestId('draftPanelBodyImage');

        this.deleteButton = container.locator('#draft_icon-trash-can-outline_delete');
        this.editButton = container.locator('#draft_icon-pencil-outline_edit');
        this.copyTextButton = container.locator('#draft_icon-content-copy_copy_text');
        this.rescheduleButton = container.locator('#draft_icon-clock-send-outline_reschedule');
        this.sendNowButton = container.locator('#draft_icon-send-outline_sendNow');

        this.editTextBox = container.getByTestId('edit_textbox');
        this.saveButton = container.getByRole('button', {name: en['edit_post.action_buttons.save']});
        this.cancelButton = container.getByRole('button', {name: en['edit_post.action_buttons.cancel']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async hover() {
        await this.container.hover();
    }
}
