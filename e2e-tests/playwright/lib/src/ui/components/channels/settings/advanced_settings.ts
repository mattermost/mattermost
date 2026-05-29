// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class AdvancedSettings {
    readonly container: Locator;

    readonly title;
    public id = '#advancedSettings';
    readonly expandedSection;
    public expandedSectionId = '.section-max';

    readonly ctrlEnterEditButton;
    readonly postFormattingEditButton;
    readonly joinLeaveEditButton;
    readonly autoStatusUpdateEditButton;
    readonly scrollPositionEditButton;
    readonly syncDraftsEditButton;

    readonly autoStatusUpdateOnRadio;
    readonly autoStatusUpdateOffRadio;
    readonly saveButton;

    constructor(container: Locator) {
        this.container = container;

        this.title = container.getByRole('heading', {name: 'Advanced Settings', exact: true});
        this.expandedSection = container.locator(this.expandedSectionId);

        // Edit buttons for each setting section
        this.ctrlEnterEditButton = container.locator('#advancedCtrlSendEdit');
        this.postFormattingEditButton = container.locator('#formattingEdit');
        this.joinLeaveEditButton = container.locator('#joinLeaveEdit');
        this.autoStatusUpdateEditButton = container.locator('#autoStatusUpdateEdit');
        this.scrollPositionEditButton = container.locator('#unread_scroll_positionEdit');
        this.syncDraftsEditButton = container.locator('#syncDraftsEdit');

        // Automatic status updates section controls
        this.autoStatusUpdateOnRadio = container.locator('#autoStatusUpdateOn');
        this.autoStatusUpdateOffRadio = container.locator('#autoStatusUpdateOff');
        this.saveButton = container.locator('#saveSetting');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async setAutoStatusUpdate(enabled: boolean) {
        await expect(this.autoStatusUpdateEditButton).toBeVisible();
        await this.autoStatusUpdateEditButton.click();

        const radio = enabled ? this.autoStatusUpdateOnRadio : this.autoStatusUpdateOffRadio;
        await expect(radio).toBeVisible();
        await radio.check();

        await this.saveButton.click();
        await expect(this.autoStatusUpdateEditButton).toBeVisible();
    }
}
