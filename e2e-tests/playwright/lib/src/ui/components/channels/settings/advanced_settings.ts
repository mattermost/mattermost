// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class AdvancedSettings extends BaseComponent {
    readonly title;
    public id = '#advancedSettings';
    readonly expandedSection;
    public expandedSectionId = 'section-max';

    readonly ctrlEnterEditButton;
    readonly postFormattingEditButton;
    readonly joinLeaveEditButton;
    readonly scrollPositionEditButton;
    readonly syncDraftsEditButton;

    constructor(container: Locator) {
        super(container);

        this.title = container.getByRole('heading', {name: en['user.settings.advance.title'], exact: true});
        this.expandedSection = container.getByTestId(this.expandedSectionId);

        // Edit buttons for each setting section
        this.ctrlEnterEditButton = container.locator('#advancedCtrlSendEdit');
        this.postFormattingEditButton = container.locator('#formattingEdit');
        this.joinLeaveEditButton = container.locator('#joinLeaveEdit');
        this.scrollPositionEditButton = container.locator('#unread_scroll_positionEdit');
        this.syncDraftsEditButton = container.locator('#syncDraftsEdit');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
