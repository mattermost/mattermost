// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class DraftPost extends BaseComponent {
    readonly panelHeader;
    readonly panelBody;

    readonly postBody;
    readonly postHeader;
    readonly postImage;

    readonly deleteButton;
    readonly editButton;
    readonly scheduleButton;
    readonly sendButton;

    constructor(container: Locator) {
        super(container);

        this.panelHeader = container.getByTestId('panelHeader');
        this.panelBody = container.getByTestId('draftPanelBody');

        this.postBody = container.getByTestId('draftPanelBodyContent');
        this.postHeader = container.getByTestId('draftPanelBodyHeader');
        this.postImage = container.getByTestId('draftPanelBodyImage');

        this.deleteButton = container.locator('#draft_icon-trash-can-outline_delete');
        this.editButton = container.locator('#draft_icon-pencil-outline_edit');
        this.scheduleButton = container.locator('#draft_icon-clock-send-outline_reschedule');
        this.sendButton = container.locator('#draft_icon-send-outline_send');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async hover() {
        await this.container.hover();
    }
}
