// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ScheduledDraftMenu {
    readonly container: Locator;

    readonly scheduleDraftMessageCustomTimeOption;

    constructor(container: Locator) {
        this.container = container;

        this.scheduleDraftMessageCustomTimeOption = container.getByText('Choose a custom time');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async selectCustomTime() {
        await this.scheduleDraftMessageCustomTimeOption.click();
    }
}

export {ScheduledDraftMenu};
