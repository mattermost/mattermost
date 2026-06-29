// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class SidebarSettings extends BaseComponent {
    readonly title;
    public id = '#sidebarSettings';
    readonly expandedSection;
    public expandedSectionId = 'section-max';

    readonly groupUnreadEditButton;
    readonly limitVisibleDMsEditButton;

    constructor(container: Locator) {
        super(container);

        this.title = container.getByRole('heading', {name: en['user.settings.modal.sidebar'], exact: true});
        this.expandedSection = container.getByTestId(this.expandedSectionId);

        this.groupUnreadEditButton = container.locator('#showUnreadsCategoryEdit');
        this.limitVisibleDMsEditButton = container.locator('#limitVisibleGMsDMsEdit');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
