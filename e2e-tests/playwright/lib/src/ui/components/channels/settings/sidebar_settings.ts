// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class SidebarSettings {
    readonly container: Locator;

    readonly title;
    public id = '#sidebarSettings';
    readonly expandedSection;
    public expandedSectionId = '.section-max';

    readonly groupUnreadEditButton;
    readonly limitVisibleDMsEditButton;

    constructor(container: Locator) {
        this.container = container;

        this.title = container.getByRole('heading', {name: 'Sidebar', exact: true});
        this.expandedSection = container.locator(this.expandedSectionId);

        this.groupUnreadEditButton = container.locator('#showUnreadsCategoryEdit');
        this.limitVisibleDMsEditButton = container.locator('#limitVisibleGMsDMsEdit');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
