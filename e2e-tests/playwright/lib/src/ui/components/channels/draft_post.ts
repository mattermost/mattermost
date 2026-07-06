// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class DraftPost {
    readonly container: Locator;

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
        this.container = container;

        this.panelHeader = container.getByTestId('draft-panel-header');
        this.panelBody = container.getByTestId('draft-panel-body');

        this.postBody = container.getByTestId('draft-post-body');
        this.postHeader = container.getByTestId('draft-post-header');
        this.postImage = container.getByTestId('draft-post-img');

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
