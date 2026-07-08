// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';

import SelfDeletingMessages from '../self_deleting_messages';

/**
 * System Console -> Site Configuration -> Posts
 */
export default class Posts {
    readonly container: Locator;
    readonly selfDeletingMessages: SelfDeletingMessages;

    constructor(adminConsoleWrapper: Locator, page: Page) {
        this.container = adminConsoleWrapper.getByTestId('sysconsole_section_PostSettings');
        this.selfDeletingMessages = new SelfDeletingMessages(this.container, page);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
