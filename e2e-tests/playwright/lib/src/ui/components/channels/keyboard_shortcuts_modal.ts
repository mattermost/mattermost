// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

export default class KeyboardShortcutsModal {
    readonly page: Page;

    readonly heading;
    readonly closeButton;

    constructor(page: Page) {
        this.page = page;

        // The modal title renders as a level-1 heading whose accessible name
        // begins with "Keyboard shortcuts" followed by the Ctrl/Cmd + / sequence.
        this.heading = page.getByRole('heading', {name: /Keyboard shortcuts/i});
        this.closeButton = page.getByRole('button', {name: 'Close'});
    }

    async toBeVisible() {
        await expect(this.heading).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.heading).not.toBeVisible();
    }

    async closeWithButton() {
        await this.closeButton.click();
        await this.notToBeVisible();
    }

    async closeWithEscape() {
        await this.page.keyboard.press('Escape');
        await this.notToBeVisible();
    }
}
